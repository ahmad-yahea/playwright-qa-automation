import { TEST_EMAIL_DOMAIN, mail } from './env';

/** Fresh email for a new account: the mailbox address with a unique "+alias", e.g. qa+pw1730000000-ab12@example.com. */
export function freshEmail(): string {
  const [local, domain] = mail.addressBase.split('@');
  return `${local}+pw${Date.now()}-${Math.random().toString(36).slice(2, 6)}@${domain}`;
}

/** A throwaway address that was never registered, e.g. qa.lockout.1730000000000@<your test domain>. Nothing is ever sent to it. */
export const testEmail = (label: string) => `qa.${label}.${Date.now()}@${TEST_EMAIL_DOMAIN}`;

/** Password that satisfies the policy (upper, lower, digit, symbol, 8+ chars) and is not a common one. */
export const freshPassword = () => `Pw!${Math.random().toString(36).slice(2, 10)}Zq9`;

/** A made-up Irish mobile number in E.164 format. */
export const freshPhone = () => `+35387${Math.floor(1000000 + Math.random() * 8999999)}`;

/** Picks an in-stock product from the public list (min stock given), so tests never hard-code product ids. */
export function pickProduct(products: any[], minStock = 5) {
  const p = products.find((x) => x.stock >= minStock);
  if (!p) throw new Error(`No product with stock >= ${minStock} on this environment`);
  return p;
}
