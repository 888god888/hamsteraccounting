import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleFor, summarize, validateEntry, exportCSV, today } from '../src/domain.js';
const h = {target:10000,refill_day:15,owner_share:60,start_date:'2026-01-15'};
const e=(kind,amount,occurred_on,person='owner',extra={})=>({kind,amount,occurred_on,person,category:'meal',note:'測試',...extra});
test('15 號當天開始新一期，14 號仍在上期；跨年正確',()=>{
 assert.deepEqual(cycleFor('2026-11-14',15),{start:'2026-10-15',end:'2026-11-14',next:'2026-11-15'});
 assert.equal(cycleFor('2026-11-15',15).start,'2026-11-15');
 assert.equal(cycleFor('2026-01-02',15).start,'2025-12-15');
});
test('31 號補款在短月份使用月底，閏年正確',()=>{
 assert.equal(cycleFor('2026-02-28',31).start,'2026-02-28');
 assert.equal(cycleFor('2026-03-01',31).next,'2026-03-31');
 assert.equal(cycleFor('2024-02-29',31).start,'2024-02-29');
});
test('結餘 3000 只補 7000，分攤 4200/2800，新支出不增加應補款',()=>{
 const entries=[e('opening',10000,'2026-01-15'),e('expense',7000,'2026-10-20'),e('expense',1000,'2026-11-16')];
 const s=summarize(h,entries,'2026-11-18');
 assert.equal(s.opening,3000);assert.equal(s.required,7000);assert.equal(s.ownerDue,4200);assert.equal(s.partnerDue,2800);assert.equal(s.remaining,7000);assert.equal(s.balance,2000);
});
test('雙人分次補款分開追蹤，刪除、未來日期不計入',()=>{
 const s=summarize(h,[e('opening',3000,'2026-01-15'),e('deposit',2000,'2026-11-15'),e('deposit',1000,'2026-11-16','partner'),e('deposit',999,'2026-11-16','partner',{deleted_at:'now'}),e('deposit',999,'2026-12-15')],'2026-11-18');
 assert.equal(s.ownerRemaining,2200);assert.equal(s.partnerRemaining,1800);assert.equal(s.remaining,4000);assert.equal(s.balance,6000);
});
test('首次在期中建立，期初餘額不算補款；無條件進位尾差不會多收',()=>{
 const s=summarize({...h,start_date:'2026-11-18'},[e('opening',3001,'2026-11-18')],'2026-11-18');
 assert.equal(s.opening,3001);assert.equal(s.required,6999);assert.equal(s.ownerDue+s.partnerDue,6999);
});
test('超額存款結轉，餘額超過目標不需補款，負餘額補足',()=>{
 assert.equal(summarize(h,[e('opening',12000,'2026-01-15')],'2026-11-18').required,0);
 assert.equal(summarize(h,[e('opening',10000,'2026-01-15'),e('expense',12000,'2026-10-20')],'2026-11-18').required,12000);
});
test('舊期報表不包含當期以後的支出',()=>{
 const s=summarize(h,[e('opening',10000,'2026-01-15'),e('expense',7000,'2026-10-20'),e('expense',1000,'2026-11-16')],'2026-11-18',-1);
 assert.equal(s.balance,3000);assert.equal(s.spent,7000);
});
test('輸入限制拒絕小數、負數、非法日期、未來日期',()=>{
 const good=e('expense',100,'2026-11-18');
 assert.equal(validateEntry(good,h.start_date,'2026-11-18'),good);
 for(const patch of [{amount:1.5},{amount:-1},{amount:0},{occurred_on:'2026-02-30'},{occurred_on:'2026-11-19'},{note:'   '},{person:'stranger'}])assert.throws(()=>validateEntry({...good,...patch},h.start_date,'2026-11-18'));
});
test('CSV 正確轉義與阻擋試算表公式',()=>{
 const csv=exportCSV([e('expense',100,'2026-11-18','owner',{note:'=HYPERLINK("x")'}),e('expense',20,'2026-11-18','owner',{deleted_at:'now'})]);
 assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes("\"'=HYPERLINK(\"\"x\"\")\""));assert.equal(csv.split('\r\n').length,2);
});
test('日期固定為台北時區',()=>assert.equal(today(new Date('2026-11-14T16:05:00Z')),'2026-11-15'));
