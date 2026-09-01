import './load-env.js';
import { toWhatsAppDigits } from './phone.js';

const DEFAULT_SMS_GATEWAY_URL = 'http://prem-eu2.bot-hosting.net:21724';
const FR_MOBILE = /^\+33[67]\d{8}$/;

let cachedToken = null;
let cachedTokenAt = 0;

function smsGatewayUrl() {
  const raw = process.env.SMS_GATEWAY_URL || DEFAULT_SMS_GATEWAY_URL;
  let url = String(raw || '')
    .trim()
    .replace(/\/$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

function smsSecret() {
  return String(process.env.SMS_GATEWAY_SECRET || process.env.OUTBOUND_API_SECRET || '').trim();
}

function smsAdminEmail() {
  return String(
    process.env.SMS_GATEWAY_EMAIL || process.env.ADMIN_EMAIL || 'angoularaphael05@gmail.com'
  ).trim();
}

function smsAdminPassword() {
  return String(process.env.SMS_GATEWAY_PASSWORD || process.env.ADMIN_PASSWORD || 'Fareno12').trim();
}

function toE164(phone) {
  const digits = toWhatsAppDigits(phone);
  if (!digits) return null;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function isFrMobile(e164) {
  return FR_MOBILE.test(String(e164 || ''));
}

function toGsmSafe(text) {
  return String(text || '')
    .replace(/€/g, 'euros')
    .replace(/[‘’‚‛‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/ê/g, 'e')
    .replace(/Ê/g, 'E')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/ô/g, 'o')
    .replace(/Ô/g, 'O')
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/\*/g, '')
    .replace(/~/g, '-')
    .replace(/ +/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
}

async function smsJson(fetchImpl, path, { method = 'GET', body, headers = {} } = {}) {
  const base = smsGatewayUrl();
  if (!base) throw new Error('SMS_GATEWAY_URL manquant');
  const res = await fetchImpl(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 180) || `HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function smsGatewayToken(fetchImpl) {
  if (cachedToken && Date.now() - cachedTokenAt < 50 * 60 * 1000) return cachedToken;
  const email = smsAdminEmail();
  const password = smsAdminPassword();
  if (!email || !password) throw new Error('SMS_GATEWAY_EMAIL / SMS_GATEWAY_PASSWORD manquants');
  const data = await smsJson(fetchImpl, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!data?.token) throw new Error('Login SMS gateway sans token');
  cachedToken = data.token;
  cachedTokenAt = Date.now();
  return cachedToken;
}

async function sendViaCampaign(fetchImpl, telephone, message) {
  const token = await smsGatewayToken(fetchImpl);
  const auth = { Authorization: `Bearer ${token}` };
  const campaign = await smsJson(fetchImpl, '/api/campaigns', {
    method: 'POST',
    headers: auth,
    body: {
      name: `Concours SMS ${Date.now()}`.slice(0, 80),
      message,
    },
  });
  if (!campaign?.id) throw new Error('Création campagne SMS échouée');
  await smsJson(fetchImpl, `/api/campaigns/${campaign.id}/contacts`, {
    method: 'POST',
    headers: auth,
    body: {
      prenom: 'Client',
      nom: 'concours',
      telephone: String(telephone).replace(/\D/g, ''),
    },
  });
  const start = await smsJson(fetchImpl, `/api/campaigns/${campaign.id}/start`, {
    method: 'POST',
    headers: auth,
  });
  if (!start?.queued) throw new Error('SMS non mis en file (campagne)');
  return {
    sent: true,
    queued: true,
    via: 'sms-campaign',
    campaignId: campaign.id,
    telephone,
  };
}

export async function sendWhatsAppMessage(phone, message, { fetchImpl = fetch, dryRun = false } = {}) {
  if (dryRun) return { sent: true, reason: 'dry_run' };
  const to = toE164(phone);
  if (!to) throw new Error('Numéro invalide');
  if (!isFrMobile(to)) return { sent: false, reason: 'numero_invalide' };
  const base = smsGatewayUrl();
  if (!base) return { sent: false, reason: 'sms_not_configured' };
  const text = toGsmSafe(message);
  const secret = smsSecret();
  try {
    const headers = {};
    if (secret) headers['x-api-secret'] = secret;
    else {
      headers.Authorization = `Bearer ${await smsGatewayToken(fetchImpl)}`;
    }
    const data = await smsJson(fetchImpl, '/api/messages/send', {
      method: 'POST',
      headers,
      body: { telephone: to, message: text, source: 'concours' },
    });
    return { sent: true, via: 'sms', ...data };
  } catch {
    return sendViaCampaign(fetchImpl, to, text);
  }
}
