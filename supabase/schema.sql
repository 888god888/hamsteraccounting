-- Run once in a NEW Supabase project's SQL Editor. Safe to rerun unchanged.
begin;
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  owner_id uuid not null references auth.users(id),
  target integer not null default 10000 check (target between 1 and 10000000),
  refill_day integer not null default 15 check (refill_day between 1 and 31),
  owner_share integer not null default 60 check (owner_share between 0 and 100),
  start_date date not null default ((now() at time zone 'Asia/Taipei')::date),
  created_at timestamptz not null default now()
);
create table if not exists public.members (
  user_id uuid primary key references auth.users(id),
  household_id uuid not null references public.households(id),
  slot text not null check (slot in ('owner','partner')),
  display_name text not null check (char_length(display_name) between 1 and 20),
  unique(household_id, slot)
);
create table if not exists public.household_invites (
  household_id uuid primary key references public.households(id),
  code text unique not null default replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default now() + interval '7 days'
);
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  kind text not null check (kind in ('expense','deposit','opening')),
  amount integer not null check (amount between 1 and 10000000),
  occurred_on date not null,
  category text not null default 'other' check (category in ('meal','drink','snack','grocery','other')),
  person text not null check (person in ('owner','partner')),
  note text not null check (char_length(note) between 1 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision integer not null default 1
);
create index if not exists entries_household_date on public.entries(household_id, occurred_on, id);
create index if not exists members_household on public.members(household_id);
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.household_invites enable row level security;
alter table public.entries enable row level security;

-- A fixed search_path + qualified tables prevents search_path injection.
create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.members where user_id = (select auth.uid());
$$;
revoke all on function public.my_household() from public, anon;
grant execute on function public.my_household() to authenticated;
drop policy if exists household_read on public.households;
create policy household_read on public.households for select to authenticated using (id = (select public.my_household()));
drop policy if exists member_read on public.members;
create policy member_read on public.members for select to authenticated using (household_id = (select public.my_household()));
drop policy if exists entry_read on public.entries;
create policy entry_read on public.entries for select to authenticated using (household_id = (select public.my_household()));
revoke all on public.households, public.members, public.household_invites, public.entries from anon, authenticated;
grant select on public.households, public.members, public.entries to authenticated;

create or replace function public.create_household(p_name text, p_display_name text, p_opening integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare h uuid; u uuid := auth.uid(); d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if u is null then raise exception '請先登入'; end if;
  -- Lock the user's auth row to serialize create/join across devices.
  perform 1 from auth.users where id = u for update;
  if exists(select 1 from public.members where user_id = u) then raise exception '你已加入一本帳本'; end if;
  if p_opening < 0 or p_opening > 10000000 or p_opening is null then raise exception '期初餘額需為 0～10,000,000'; end if;
  insert into public.households(name, owner_id, start_date) values(trim(p_name),u,d) returning id into h;
  insert into public.members values(u,h,'owner',trim(p_display_name));
  insert into public.household_invites(household_id) values(h);
  if p_opening > 0 then
    insert into public.entries(household_id,kind,amount,occurred_on,person,note,created_by)
    values(h,'opening',p_opening,d,'owner','帳本啟用餘額',u);
  end if;
  return h;
end; $$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare h uuid; u uuid := auth.uid();
begin
  if u is null then raise exception '請先登入'; end if;
  perform 1 from auth.users where id = u for update;
  if exists(select 1 from public.members where user_id = u) then raise exception '你已加入一本帳本'; end if;
  select i.household_id into h from public.household_invites i where i.code = lower(trim(p_code)) and i.expires_at > now();
  if h is null then raise exception '邀請碼無效或已過期'; end if;
  perform 1 from public.households where id = h for update;
  -- Recheck after the household lock (a concurrent invite rotation may occur).
  if not exists(select 1 from public.household_invites where household_id=h and code=lower(trim(p_code)) and expires_at>now()) then raise exception '邀請碼已更新'; end if;
  if (select count(*) from public.members where household_id = h) >= 2 then raise exception '這本帳本已經有兩位成員囉'; end if;
  insert into public.members values(u,h,'partner',trim(p_display_name));
  delete from public.household_invites where household_id = h;
  return h;
end; $$;

create or replace function public.get_invite(p_rotate boolean default false)
returns table(code text, expires_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare h uuid := public.my_household();
begin
  perform 1 from public.households where id=h and owner_id=auth.uid() for update;
  if not found then raise exception '只有建立者能產生邀請碼'; end if;
  if (select count(*) from public.members where household_id = h) >= 2 then raise exception '兩位成員都到齊了'; end if;
  if p_rotate then delete from public.household_invites where household_id=h; end if;
  insert into public.household_invites(household_id) values(h) on conflict do nothing;
  update public.household_invites i set code=replace(gen_random_uuid()::text,'-',''), expires_at=now()+interval '7 days' where i.household_id=h and i.expires_at<=now();
  return query select i.code, i.expires_at from public.household_invites i where i.household_id=h;
end; $$;

create or replace function public.save_entry(p_id uuid, p_kind text, p_amount integer, p_date date, p_category text, p_person text, p_note text, p_revision integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare h uuid := public.my_household(); s date; old public.entries%rowtype;
begin
  select start_date into s from public.households where id=h for update;
  if not found then raise exception '請先加入帳本'; end if;
  if p_revision is null or p_revision < 0 then raise exception '無效的紀錄版本'; end if;
  if p_kind not in ('expense','deposit') or p_kind is null then raise exception '無效的記帳類型'; end if;
  if p_date < s or p_date > (now() at time zone 'Asia/Taipei')::date or p_date is null then raise exception '日期需介於啟用日與今天'; end if;
  select * into old from public.entries where id=p_id;
  if found then
    if old.household_id<>h or old.kind='opening' or old.deleted_at is not null then raise exception '無法修改這筆紀錄'; end if;
    -- Retrying a successful insert with the same UUID must not duplicate or overwrite it.
    if p_revision = 0 then
      if old.kind=p_kind and old.amount=p_amount and old.occurred_on=p_date and old.category=p_category and old.person=p_person and old.note=trim(p_note) then return p_id; end if;
      raise exception '這筆記錄已存在，請重新整理';
    end if;
    if old.revision<>p_revision then raise exception '另一台手機已修改這筆記錄，請重新整理'; end if;
    update public.entries set kind=p_kind,amount=p_amount,occurred_on=p_date,category=p_category,person=p_person,note=trim(p_note),updated_at=now(),revision=revision+1 where id=p_id;
  else
    if p_revision<>0 then raise exception '找不到這筆記錄'; end if;
    insert into public.entries(id,household_id,kind,amount,occurred_on,category,person,note,created_by) values(p_id,h,p_kind,p_amount,p_date,p_category,p_person,trim(p_note),auth.uid());
  end if;
  return p_id;
end; $$;

create or replace function public.delete_entry(p_id uuid, p_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare h uuid := public.my_household();
begin
  perform 1 from public.households where id=h for update;
  if not found then raise exception '請先加入帳本'; end if;
  update public.entries set deleted_at=now(),updated_at=now(),revision=revision+1
  where id=p_id and household_id=h and kind<>'opening' and deleted_at is null and revision=p_revision;
  if not found then raise exception '紀錄已變更，請重新整理'; end if;
end; $$;

create or replace function public.update_settings(p_name text, p_target integer, p_day integer, p_share integer, p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare h uuid := public.my_household(); old public.households%rowtype;
begin
  select * into old from public.households where id=h for update;
  if not found then raise exception '請先加入帳本'; end if;
  if old.owner_id<>auth.uid() and (old.name<>trim(p_name) or old.target<>p_target or old.refill_day<>p_day or old.owner_share<>p_share) then raise exception '帳本規則由建立者修改'; end if;
  update public.households set name=trim(p_name),target=p_target,refill_day=p_day,owner_share=p_share where id=h;
  update public.members set display_name=trim(p_display_name) where user_id=auth.uid();
end; $$;

revoke all on function public.create_household(text,text,integer), public.join_household(text,text), public.get_invite(boolean), public.save_entry(uuid,text,integer,date,text,text,text,integer), public.delete_entry(uuid,integer), public.update_settings(text,integer,integer,integer,text) from public, anon;
grant execute on function public.create_household(text,text,integer), public.join_household(text,text), public.get_invite(boolean), public.save_entry(uuid,text,integer,date,text,text,text,integer), public.delete_entry(uuid,integer), public.update_settings(text,integer,integer,integer,text) to authenticated;

-- Soft deletes produce UPDATE events, keeping household_id available for realtime filtering.
do $$ declare tbl text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach tbl in array array['entries','households','members'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then
        execute format('alter publication supabase_realtime add table public.%I',tbl);
      end if;
    end loop;
  end if;
end $$;
commit;
