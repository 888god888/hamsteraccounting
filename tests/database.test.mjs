import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
let db;
const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
async function asUser(u,sql,params=[]){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u||'']);
 await db.exec('set role authenticated');
 try{return await db.query(sql,params);}finally{await db.exec('reset role');}
}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to anon,authenticated;`);
 for(const id of users)await db.query('insert into auth.users values($1)',[id]);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
});
after(async()=>{if(db)await db.close();});
test('完整雙人流程、RLS、邀請與衝突控制',async()=>{
 const created=await asUser(users[0],"select public.create_household('我們的基金','我',3000) as id");const hid=created.rows[0].id;
 assert.equal((await asUser(users[0],'select * from households')).rows.length,1);
 assert.equal((await asUser(users[2],'select * from households')).rows.length,0);
 assert.equal((await asUser(users[2],'select * from entries')).rows.length,0);
 await assert.rejects(asUser(users[2],"insert into entries(household_id,kind,amount,occurred_on,person,note,created_by) values($1,'deposit',1,current_date,'owner','x',$2)",[hid,users[2]]),/permission denied/);
 await assert.rejects(asUser(null,"select public.create_household('bad','bad',0)"),/請先登入/);
 const inv=await asUser(users[0],'select * from public.get_invite(false)');const code=inv.rows[0].code;
 await assert.rejects(asUser(users[2],'select * from household_invites'),/permission denied/);
 await assert.rejects(asUser(users[1],"select public.join_household('invalid','女友')"),/邀請碼/);
 await asUser(users[1],"select public.join_household($1,'女友')",[code]);
 assert.equal((await asUser(users[1],'select * from members')).rows.length,2);
 await assert.rejects(asUser(users[2],"select public.join_household($1,'第三人')",[code]),/邀請碼/);
 const id='44444444-4444-4444-8444-444444444444';
 const sql="select public.save_entry($1,'expense',$2,(now() at time zone 'Asia/Taipei')::date,'meal','owner','一起吃飯',$3)";
 await asUser(users[0],sql,[id,100,0]);
 await asUser(users[0],sql,[id,100,0]);
 assert.equal((await asUser(users[0],'select * from entries where id=$1',[id])).rows.length,1,'重試不會新增兩次');
 await assert.rejects(asUser(users[2],sql,[id,500,1]),/加入帳本/);
 await asUser(users[1],sql,[id,120,1]);
 await assert.rejects(asUser(users[0],sql,[id,130,1]),/另一台手機/);
 await assert.rejects(asUser(users[1],"select public.update_settings('新名稱',10000,15,60,'女友')"),/建立者/);
 await assert.rejects(asUser(users[0],"select public.save_entry(gen_random_uuid(),'expense',-1,(now() at time zone 'Asia/Taipei')::date,'meal','owner','x',0)"),/check constraint/);
 await assert.rejects(asUser(users[0],"select public.save_entry(gen_random_uuid(),'expense',10,(now() at time zone 'Asia/Taipei')::date+1,'meal','owner','x',0)"),/日期/);
 await asUser(users[0],'select public.delete_entry($1,2)',[id]);
 const deleted=(await asUser(users[1],'select * from entries where id=$1',[id])).rows[0];assert.ok(deleted.deleted_at);assert.equal(deleted.revision,3);
 const opening=(await asUser(users[0],"select * from entries where kind='opening'")).rows[0];
 await assert.rejects(asUser(users[0],'select public.delete_entry($1,1)',[opening.id]),/紀錄已變更/);
 await asUser(users[2],"select public.create_household('別人的帳本','第三人',0)");
 assert.equal((await asUser(users[2],'select * from entries where household_id=$1',[hid])).rows.length,0);
 await assert.rejects(asUser(users[2],sql,[id,500,3]),/無法修改/);
 await assert.rejects(asUser(users[0],sql,[id,500,null]),/無效的紀錄版本/);
 // The unchanged migration can be rerun without losing data or opening permissions.
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 assert.equal((await asUser(users[1],'select * from households')).rows.length,1);
 await db.exec('set role anon');await assert.rejects(db.query('select * from entries'),/permission denied/);await db.exec('reset role');
});
