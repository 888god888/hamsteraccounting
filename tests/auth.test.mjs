import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, accountIdentifier, accountLabel, registerAccount, loginAccount } from '../src/auth.js';
test('自訂帳號正規化，拒絕真實信箱與不合法字元註冊',()=>{
 assert.equal(normalizeUsername(' Ray_101 '),'ray_101');
 for(const v of ['ab','a'.repeat(25),'ray@gmail.com','a b c','ray+test','倉鼠'])assert.throws(()=>normalizeUsername(v));
});
test('帳號使用保留的非寄信網域，不需使用者信箱',()=>{
 assert.deepEqual(accountIdentifier('Ray_101'),{email:'u_ray_101@accounts.hamster.invalid',username:'ray_101'});
 assert.equal(accountLabel({email:'u_ray_101@accounts.hamster.invalid'}),'ray_101');
 assert.notEqual(accountIdentifier('ray_101').email,accountIdentifier('ray_102').email);
 assert.equal(accountIdentifier('RAY_101').email,accountIdentifier('ray_101').email);
});
test('舊版信箱帳號仍能登入且不改變原始身分',async()=>{
 let sent;const user={id:'original-id',email:'old@example.com'};
 const client={auth:{signInWithPassword:async args=>{sent=args;return {data:{user,session:{user}}};}}};
 const result=await loginAccount(client,' OLD@example.com ','test-password-123');
 assert.equal(sent.email,'old@example.com');assert.equal(result.data.user.id,'original-id');
});
test('註冊與登入使用相同身分，只將密碼交給 Auth API',async()=>{
 const calls=[];const client={auth:{signUp:async args=>{calls.push(['signup',args]);return {data:{session:{},user:{}}};},signInWithPassword:async args=>{calls.push(['login',args]);return {data:{session:{},user:{}}};}}};
 await registerAccount(client,'Ray_101','test-password-123','test-password-123');await loginAccount(client,'ray_101','test-password-123');
 assert.equal(calls[0][1].email,calls[1][1].email);assert.equal(calls[0][1].options.data.username,'ray_101');assert.equal(calls[0][1].options.emailRedirectTo,undefined);
});
test('錯誤的確認密碼與短密碼不會送往伺服器',async()=>{
 let called=false;const client={auth:{signUp:async()=>{called=true;},signInWithPassword:async()=>{called=true;}}};
 await assert.rejects(registerAccount(client,'ray_101','test-password-123','different'),/不一致/);
 await assert.rejects(loginAccount(client,'ray_101','short'),/密碼/);
 await assert.rejects(registerAccount(client,'ray_101','        ','        '),/密碼/);
 assert.equal(called,false);
});
