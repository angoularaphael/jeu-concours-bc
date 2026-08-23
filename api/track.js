import '../lib/load-env.js';
import { json, readBody } from '../lib/http.js';
import { recordEvent } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method' });
    return;
  }
  const body = await readBody(req).catch(() => ({}));
  const type = String(body.event || body.type || 'page_vue').slice(0, 40);
  await recordEvent({
    type,
    source: String(body.src || body.source || 'direct').slice(0, 40),
    contact_id: body.contact_id || null,
    meta: {
      path: body.path || '/',
      medium: body.medium || body.utm_medium || null,
      campaign: body.campaign || body.utm_campaign || null,
    },
  });
  json(res, 200, { ok: true });
}
