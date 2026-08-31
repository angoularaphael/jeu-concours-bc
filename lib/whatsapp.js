import './load-env.js';
import { toWhatsAppDigits } from './phone.js';

const DEFAULT_SMS_GATEWAY_URL = 'http://prem-eu2.bot-hosting.net:21724';

function smsGatewayUrl() {
  const raw = process.env.SMS_GATEWAY_URL || DEFAULT_SMS_GATEWAY_URL;
  let url = String(raw || '').trim().replace(/\/$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

function smsSecret() {
  return String(process.env.SMS_GATEWAY_SECRET || process.env.OUTBOUND_API_SECRET || '').trim();
}

export async function sendWhatsAppMessage(phone, message, { fetchImpl = fetch, dryRun = false } = {}) {
  if (dryRun) return { sent: true, reason: 'dry_run' };
  const digits = toWhatsAppDigits(phone);
  if (!digits) throw new Error('Numéro invalide');
  const to = digits.startsWith('+') ? digits : `+${digits}`;
  const base = smsGatewayUrl();
  if (!base) return { sent: false, reason: 'sms_not_configured' };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const secret = smsSecret();
  if (secret) headers['x-api-secret'] = secret;
  const res = await fetchImpl(`${base}/api/messages/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ telephone: to, message, source: 'concours' }),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 180) || `HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return { sent: true, via: 'sms', ...data };
}
