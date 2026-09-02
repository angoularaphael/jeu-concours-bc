import { isConfigured, sendEmailViaResend } from './resend.js';

export async function sendDavidMail(copy, { to, dryRun = false } = {}) {
  const email = String(to || '')
    .trim()
    .toLowerCase();
  if (!email) return { sent: false, reason: 'no_email' };
  if (dryRun) return { sent: true, reason: 'dry_run', to: email };
  if (!isConfigured()) return { sent: false, reason: 'resend_not_configured' };
  try {
    const result = await sendEmailViaResend({
      to: email,
      subject: copy.subject,
      html: copy.html || undefined,
      text: copy.emailText,
      fromName: copy.fromName,
      headers: copy.headers,
      attachments: copy.attachments,
    });
    return { sent: true, to: email, via: result.via || 'resend', messageId: result.messageId };
  } catch (err) {
    return { sent: false, to: email, error: err.message || 'email_error' };
  }
}
