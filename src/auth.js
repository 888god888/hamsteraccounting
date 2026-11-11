// Supabase Auth requires an email-shaped identifier. This reserved, non-deliverable
// domain is an internal identifier only: users do not supply or bind an inbox.
export const ACCOUNT_DOMAIN = 'accounts.hamster.invalid';
export function normalizeUsername(value) {
  const username = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('帳號請使用 3～24 個英文字母、數字或底線');
  return username;
}
export function accountIdentifier(value, allowLegacyEmail = false) {
  const input = String(value ?? '').trim().toLowerCase();
  if (allowLegacyEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return { email: input, username: null };
  const username = normalizeUsername(input);
  return { email: `u_${username}@${ACCOUNT_DOMAIN}`, username };
}
export function accountLabel(user) {
  const email = user?.email || '';
  const suffix = '@' + ACCOUNT_DOMAIN;
  if (email.startsWith('u_') && email.endsWith(suffix)) {
    const username = email.slice(2, -suffix.length);
    if (/^[a-z0-9_]{3,24}$/.test(username)) return username;
  }
  return email;
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !password.trim()) throw new Error('密碼請使用 8～128 個字元，不能只有空白');
}
export async function registerAccount(client, account, password, confirmation) {
  const { email, username } = accountIdentifier(account);
  validatePassword(password);
  if (password !== confirmation) throw new Error('兩次輸入的密碼不一致');
  return client.auth.signUp({ email, password, options: { data: { username } } });
}
export async function loginAccount(client, account, password) {
  const { email } = accountIdentifier(account, true);
  validatePassword(password);
  return client.auth.signInWithPassword({ email, password });
}
