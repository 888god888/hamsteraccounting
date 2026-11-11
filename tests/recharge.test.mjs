import test from 'node:test';
import assert from 'node:assert/strict';
import { monthFor, rechargePlan, summarize, validateEntry, exportCSV, today } from '../src/domain.js';
const h={target:10000,refill_day:15,owner_share:60,start_date:'2026-01-15'};
const e=(kind,amount,occurred_on,person='owner',extra={})=>({kind,amount,occurred_on,person,category:'meal',note:'測試',...extra});
test('報表按自然月切分，跨年和閏年正確',()=>{
 assert.deepEqual(monthFor('2026-11-14'),{start:'2026-11-01',end:'2026-11-30',next:'2026-12-01'});
 assert.equal(monthFor('2026-01-02',-1).start,'2025-12-01');assert.equal(monthFor('2024-02-29').end,'2024-02-29');
});
test('充值採固定一組金額，不是將剩餘金額補滿',()=>{
 const s=summarize(h,[e('opening',500,'2026-01-15'),e('deposit',6000,'2026-11-02'),e('deposit',4000,'2026-11-03','partner')],'2026-11-18');
 assert.equal(s.balance,10500);assert.equal(s.plan.total,10000);assert.equal(s.plan.owner,6000);assert.equal(s.plan.partner,4000);
});
test('比例與充值總額可調整，尾差加總正確',()=>{
 for(const share of [0,1,37,50,60,73,99,100]){const p=rechargePlan(9999,share);assert.equal(p.owner+p.partner,9999);assert.equal(p.ownerShare+p.partnerShare,100);}
 assert.deepEqual(rechargePlan(15000,70),{total:15000,ownerShare:70,partnerShare:30,owner:10500,partner:4500});
 for(const [amount,share] of [[0,60],[1.5,60],[10000,101],[10000,37.5]])assert.throws(()=>rechargePlan(amount,share));
});
test('調整比例不改寫歷史金額或餘額',()=>{
 const entries=[e('opening',500,'2026-01-15'),e('deposit',6000,'2026-11-01'),e('deposit',4000,'2026-11-02','partner'),e('expense',3000,'2026-11-04')];
 const before=summarize(h,entries,'2026-11-18'),after=summarize({...h,target:15000,owner_share:73},entries,'2026-11-18');
 assert.equal(before.balance,after.balance);assert.equal(before.ownerPaid,after.ownerPaid);assert.equal(after.plan.owner,10950);assert.equal(after.plan.partner,4050);
});
test('跨月與15號不會重設餘額或產生虛構充值',()=>{
 const entries=[e('opening',500,'2026-01-15'),e('deposit',6000,'2026-10-14'),e('deposit',4000,'2026-10-16','partner'),e('expense',3000,'2026-10-20')];
 for(const date of ['2026-10-31','2026-11-01','2026-11-14','2026-11-15'])assert.equal(summarize(h,entries,date).balance,7500);
 assert.equal(summarize(h,entries,'2026-11-15').deposited,0);
});
test('分次充值、刪除、未來日期與期初餘額分開計算',()=>{
 const s=summarize(h,[e('opening',3000,'2026-01-15'),e('deposit',2000,'2026-11-01'),e('deposit',1000,'2026-11-02','partner'),e('deposit',999,'2026-11-03','partner',{deleted_at:'now'}),e('deposit',999,'2026-12-01')],'2026-11-18');
 assert.equal(s.balance,6000);assert.equal(s.totalDeposited,3000);assert.equal(s.ownerPaid,2000);assert.equal(s.partnerPaid,1000);
});
test('舊月份報表不包含以後的支出，期中啟用正確',()=>{
 const s=summarize(h,[e('opening',10000,'2026-01-15'),e('expense',7000,'2026-10-20'),e('expense',1000,'2026-11-16')],'2026-11-18',-1);assert.equal(s.balance,3000);assert.equal(s.spent,7000);
 assert.equal(summarize({...h,start_date:'2026-11-18'},[e('opening',3001,'2026-11-18')],'2026-11-18').balance,3001);
});
test('輸入限制拒絕小數、負數、非法日期、未來日期',()=>{
 const good=e('expense',100,'2026-11-18');assert.equal(validateEntry(good,h.start_date,'2026-11-18'),good);
 for(const patch of [{amount:1.5},{amount:-1},{amount:0},{occurred_on:'2026-02-30'},{occurred_on:'2026-11-19'},{note:'   '},{person:'stranger'}])assert.throws(()=>validateEntry({...good,...patch},h.start_date,'2026-11-18'));
});
test('CSV 正確轉義與阻擋試算表公式，充值名稱正確',()=>{
 const csv=exportCSV([e('expense',100,'2026-11-18','owner',{note:'=HYPERLINK("x")'}),e('deposit',6000,'2026-11-18')]);
 assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes("\"'=HYPERLINK(\"\"x\"\")\""));assert.ok(csv.includes('充值'));
});
test('日期固定為台北時區',()=>assert.equal(today(new Date('2026-11-14T16:05:00Z')),'2026-11-15'));
