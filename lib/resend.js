import './load-env.js';

const API = 'https://api.resend.com/emails';
const DEFAULT_SENDER_EMAIL = 'no-reply@boxingcenter.fr';
const DEFAULT_SENDER_NAME = 'David';
const DEFAULT_REPLY_TO = 'boxingcentertls@gmail.com';

function readApiKey() {
  return String(process.env.RESEND_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function senderEmail() {
  return process.env.RESEND_SENDER_EMAIL || DEFAULT_SENDER_EMAIL;
}

export function senderName() {
  return process.env.RESEND_SENDER_NAME || DEFAULT_SENDER_NAME;
}

export function defaultReplyTo() {
  const fromEnv = process.env.RESEND_REPLY_TO || process.env.MAIL_REPLY_TO || '';
  if (fromEnv && !/boxingcenter31/i.test(fromEnv)) return fromEnv;
  return DEFAULT_REPLY_TO;
}

export function isConfigured() {
  return Boolean(readApiKey());
}

export async function sendEmailViaResend({
  to,
  subject,
  html,
  text,
  replyTo,
  headers,
  attachments,
  tags,
  fromName,
}) {
  if (!to) throw new Error('Destinataire email manquant');
  if (!isConfigured()) throw new Error('RESEND_API_KEY manquant');

  const body = {
    from: `${fromName || senderName()} <${senderEmail()}>`,
    to: [to],
    subject: subject || 'Message Boxing Center',
    text: text || undefined,
    html: html || undefined,
    reply_to: replyTo || defaultReplyTo(),
  };
  if (headers && typeof headers === 'object') body.headers = headers;
  if (Array.isArray(attachments) && attachments.length) body.attachments = attachments;
  if (Array.isArray(tags) && tags.length) body.tags = tags;

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${readApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.name || `Resend HTTP ${res.status}`);
  }
  return {
    sent: true,
    messageId: data.id,
    via: 'resend',
    sender: senderEmail(),
  };
}

export { DEFAULT_SENDER_EMAIL, DEFAULT_SENDER_NAME };
