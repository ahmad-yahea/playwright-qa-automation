import { ImapFlow } from 'imapflow';
import { VERIFY_EMAIL_SUBJECT, mail } from './env';

/**
 * Waits for the newest verification email sent to `toAddress` (an "+alias" of MAIL_ADDRESS_BASE) and
 * returns the /verify-email?token=... link. Works with any provider that offers IMAP.
 */
export async function waitForVerifyLink(toAddress: string, timeoutMs = 90_000): Promise<string> {
  const client = new ImapFlow({
    host: mail.host, port: mail.port, secure: mail.port === 993, logger: false,
    auth: { user: mail.user, pass: mail.password },
  });
  await client.connect();
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const ids = await client.search({ to: toAddress, subject: VERIFY_EMAIL_SUBJECT });
        if (ids && ids.length) {
          const msg = await client.fetchOne(String(ids[ids.length - 1]), { source: true });
          const text = msg && msg.source ? msg.source.toString().replace(/=\r?\n/g, '').replace(/=3D/g, '=') : '';
          const link = text.match(/https?:\/\/[^\s"'<>]*verify-email\?token=[^\s"'<>]+/);
          if (link) return link[0];
        }
      } finally { lock.release(); }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`Verification email for ${toAddress} did not arrive in ${timeoutMs / 1000}s (check MAIL_* settings)`);
  } finally { await client.logout(); }
}

/** Extracts the token query parameter from a verification link. */
export const tokenFromLink = (link: string) => new URL(link).searchParams.get('token') ?? '';
