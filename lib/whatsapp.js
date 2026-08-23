import './load-env.js';
import { toWhatsAppDigits } from './phone.js';

function whatsappBotUrl() {
  const raw = process.env.WHATSAPP_BOT_URL || '';
  let url = String(raw || '').trim().replace(/\/$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

function botSecret() {
  return String(process.env.WHATSAPP_BOT_SECRET || '').trim();
}

export async function sendWhatsAppMessage(phone, message, { fetchImpl = fetch, dryRun = false } = {}) {
  if (dryRun) return { sent: true, reason: 'dry_run' };
  const to = toWhatsAppDigits(phone);
  if (!to) throw new Error('Numéro WhatsApp invalide');
  const base = whatsappBotUrl();
  if (!base) return { sent: false, reason: 'whatsapp_not_configured' };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const secret = botSecret();
  if (secret) headers['x-api-secret'] = secret;
  const res = await fetchImpl(`${base}/api/send-message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: to, message }),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 180) || `HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return { sent: true, ...data };
}
