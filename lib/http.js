export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function queryFromUrl(req) {
  try {
    const host = req.headers?.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function isProduction() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/** En prod, WhatsApp part vraiment. DRY_RUN=1 reste possible uniquement via env (jamais via ?test=). */
export function isDryRunRequest(req, body = {}) {
  if (String(process.env.DRY_RUN || '') === '1') return true;
  if (isProduction()) return false;
  const q = queryFromUrl(req);
  if (q.test === '1' || q.dry === '1') return true;
  if (req.headers?.['x-dry-run'] === '1') return true;
  if (body.test === true || body.dry_run === true) return true;
  return false;
}

export function publicUrl() {
  const explicit = String(process.env.PUBLIC_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${String(vercelHost).replace(/^https?:\/\//, '')}`.replace(/\/$/, '');
  return 'https://concours.boxingcenter.fr';
}

export function adminTokenOk(req) {
  const expected = String(process.env.ADMIN_TOKEN || '').trim();
  if (!expected) return false;
  const header = String(req.headers?.['x-admin-token'] || req.headers?.authorization || '').trim();
  const bearer = header.replace(/^Bearer\s+/i, '');
  const q = queryFromUrl(req);
  const given = bearer || String(q.token || '').trim();
  return given === expected;
}

export function cronSecretOk(req) {
  const expected = String(process.env.CRON_SECRET || '').trim();
  if (!expected) return process.env.NODE_ENV !== 'production';
  const header = String(req.headers?.authorization || '').trim();
  const q = queryFromUrl(req);
  return header === `Bearer ${expected}` || q.secret === expected;
}
