export const CATEGORIES = [
  { id: 'meal', name: '正餐', icon: '🍚', color: '#6d9174' },
  { id: 'drink', name: '飲料', icon: '🧋', color: '#dcaa75' },
  { id: 'snack', name: '點心', icon: '🍮', color: '#e0a39b' },
  { id: 'grocery', name: '食材', icon: '🥬', color: '#b4c28b' },
  { id: 'other', name: '其他', icon: '🌻', color: '#aaa6bd' }
];
export const money = n => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);
export function today(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function parseDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('日期格式錯誤');
  const [y, m, d] = s.split('-').map(Number);
  const v = new Date(Date.UTC(y, m - 1, d));
  if (v.toISOString().slice(0, 10) !== s) throw new Error('日期不存在');
  return v;
}
function iso(d) { return d.toISOString().slice(0, 10); }
function boundary(y, m, day) {
  return new Date(Date.UTC(y, m, Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())));
}
export function cycleFor(date, refillDay = 15, offset = 0) {
  const d = parseDate(date);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const candidate = boundary(y, m, refillDay);
  const baseMonth = m - (d < candidate ? 1 : 0) + offset;
  const start = boundary(y, baseMonth, refillDay);
  const next = boundary(y, baseMonth + 1, refillDay);
  return { start: iso(start), end: iso(new Date(next.getTime() - 86400000)), next: iso(next) };
}
export const signed = t => t.kind === 'expense' ? -t.amount : t.amount;
export function summarize(household, transactions, date = today(), offset = 0) {
  const cycle = cycleFor(date, household.refill_day, offset);
  const start = household.start_date > cycle.start ? household.start_date : cycle.start;
  const cutoff = date < cycle.end ? date : cycle.end;
  const eligible = transactions.filter(t => !t.deleted_at && t.occurred_on <= date);
  const period = eligible.filter(t => t.occurred_on >= start && t.occurred_on <= cutoff);
  const opening = eligible.filter(t => t.occurred_on < start || (t.kind === 'opening' && t.occurred_on === start)).reduce((a,t) => a + signed(t), 0);
  const required = Math.max(0, household.target - opening);
  const deposits = period.filter(t => t.kind === 'deposit');
  const deposited = deposits.reduce((a,t) => a + t.amount, 0);
  const spent = period.filter(t => t.kind === 'expense').reduce((a,t) => a + t.amount, 0);
  const ownerDue = Math.round(required * household.owner_share / 100);
  const partnerDue = required - ownerDue;
  const ownerPaid = deposits.filter(t => t.person === 'owner').reduce((a,t) => a + t.amount, 0);
  const partnerPaid = deposits.filter(t => t.person === 'partner').reduce((a,t) => a + t.amount, 0);
  const balance = eligible.filter(t => t.occurred_on <= cutoff).reduce((a,t) => a + signed(t), 0);
  const daysLeft = Math.max(1, Math.round((parseDate(cycle.next) - parseDate(cutoff)) / 86400000));
  return { ...cycle, effectiveStart: start, opening, required, deposited, spent, balance,
    remaining: Math.max(0, required - deposited), ownerDue, partnerDue, ownerPaid, partnerPaid,
    ownerRemaining: Math.max(0, ownerDue - ownerPaid), partnerRemaining: Math.max(0, partnerDue - partnerPaid),
    daysLeft, daily: Math.max(0, Math.floor(balance / daysLeft)), period,
    categories: CATEGORIES.map(c => ({ ...c, total: period.filter(t => t.kind === 'expense' && t.category === c.id).reduce((a,t) => a + t.amount, 0) }))
  };
}
export function validateEntry(t, startDate, date = today()) {
  if (!['expense','deposit'].includes(t.kind)) throw new Error('請選擇支出或補款');
  if (!Number.isSafeInteger(t.amount) || t.amount < 1 || t.amount > 10000000) throw new Error('金額請輸入 1～10,000,000 的整數');
  parseDate(t.occurred_on);
  if (t.occurred_on < startDate || t.occurred_on > date) throw new Error('日期需介於帳本啟用日與今天之間');
  if (!['owner','partner'].includes(t.person)) throw new Error('請選擇記帳人');
  if (!CATEGORIES.some(c => c.id === t.category)) throw new Error('請選擇分類');
  if (!t.note.trim() || t.note.length > 120) throw new Error('請填寫 1～120 字的項目名稱');
  return t;
}
export function exportCSV(transactions) {
  const cell = v => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""') + '"';
  const rows = [['日期','類型','項目','分類','金額','成員'], ...transactions.filter(t=>!t.deleted_at).map(t => [t.occurred_on, {expense:'支出',deposit:'補款',opening:'期初餘額'}[t.kind], t.note, CATEGORIES.find(c=>c.id===t.category)?.name || '', t.amount, t.person === 'owner' ? '本人' : '女友'])];
  return '\ufeff' + rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
