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
export function monthFor(date, offset = 0) {
  const d = parseDate(date);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + offset;
  const start = new Date(Date.UTC(y, m, 1));
  const next = new Date(Date.UTC(y, m + 1, 1));
  return { start: iso(start), end: iso(new Date(next.getTime() - 86400000)), next: iso(next) };
}
export function rechargePlan(total, ownerShare) {
  if (!Number.isSafeInteger(total) || total < 1 || total > 10000000) throw new Error('充值總額請輸入 1～10,000,000 的整數');
  if (!Number.isInteger(ownerShare) || ownerShare < 0 || ownerShare > 100) throw new Error('比例請輸入 0～100 的整數');
  const owner = Math.round(total * ownerShare / 100);
  return { total, ownerShare, partnerShare: 100 - ownerShare, owner, partner: total - owner };
}
export const signed = t => t.kind === 'expense' ? -t.amount : t.amount;
export function summarize(household, transactions, date = today(), offset = 0) {
  const cycle = monthFor(date, offset);
  const start = household.start_date > cycle.start ? household.start_date : cycle.start;
  const cutoff = date < cycle.end ? date : cycle.end;
  const eligible = transactions.filter(t => !t.deleted_at && t.occurred_on <= cutoff);
  const period = eligible.filter(t => t.occurred_on >= start && t.occurred_on <= cutoff);
  const opening = eligible.filter(t => t.occurred_on < start || (t.kind === 'opening' && t.occurred_on === start)).reduce((a,t) => a + signed(t), 0);
  const deposits = period.filter(t => t.kind === 'deposit');
  const deposited = deposits.reduce((a,t) => a + t.amount, 0);
  const spent = period.filter(t => t.kind === 'expense').reduce((a,t) => a + t.amount, 0);
  const ownerPaid = deposits.filter(t => t.person === 'owner').reduce((a,t) => a + t.amount, 0);
  const partnerPaid = deposits.filter(t => t.person === 'partner').reduce((a,t) => a + t.amount, 0);
  const balance = eligible.reduce((a,t) => a + signed(t), 0);
  const totalDeposited = eligible.filter(t => t.kind === 'deposit').reduce((a,t) => a + t.amount, 0);
  return { ...cycle, effectiveStart: start, opening, deposited, totalDeposited, spent, balance,
    plan: rechargePlan(household.target, household.owner_share), ownerPaid, partnerPaid, period,
    categories: CATEGORIES.map(c => ({ ...c, total: period.filter(t => t.kind === 'expense' && t.category === c.id).reduce((a,t) => a + t.amount, 0) }))
  };
}
export function validateEntry(t, startDate, date = today()) {
  if (!['expense','deposit'].includes(t.kind)) throw new Error('請選擇支出或充值');
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
  const rows = [['日期','類型','項目','分類','金額','成員'], ...transactions.filter(t=>!t.deleted_at).map(t => [t.occurred_on, {expense:'支出',deposit:'充值',opening:'期初餘額'}[t.kind], t.note, CATEGORIES.find(c=>c.id===t.category)?.name || '', t.amount, t.person === 'owner' ? '本人' : '女友'])];
  return '\ufeff' + rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
