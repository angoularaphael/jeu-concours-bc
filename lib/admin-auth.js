import { createHmac, timingSafeEqual } from 'node:crypto';

function query(req) {
  try {
    const host = req.headers?.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

export function secretsEqual(provided, expected) {
  const b = Buffer.from(String(expected || ''), 'utf8');
  if (!b.length) return false;
  const a = Buffer.from(String(provided || ''), 'utf8');
  const ha = createHmac('sha256', b).update(a).digest();
  const hb = createHmac('sha256', b).update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function adminTokenValue() {
  return String(process.env.ADMIN_TOKEN || '').trim();
}

export function adminTokenOk(req) {
  const expected = adminTokenValue();
  if (!expected) return false;
  const header = String(req.headers?.['x-admin-token'] || req.headers?.authorization || '').trim();
  const bearer = header.replace(/^Bearer\s+/i, '');
  const q = query(req);
  const given = bearer || String(q.token || '').trim();
  return secretsEqual(given, expected);
}

/** Boutique SUPER_ADMIN (email + mot de passe) ou jeton ADMIN_TOKEN. */
export function verifyAdminLogin(body = {}) {
  const expectedToken = adminTokenValue();
  const token = String(body.token || body.jeton || '').trim();
  if (token && expectedToken && secretsEqual(token, expectedToken)) {
    return { ok: true, token: expectedToken };
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || body.mot_de_passe || '');
  const superEmail = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const superPass = String(process.env.SUPER_ADMIN_PASSWORD || '');
  if (
    email &&
    password &&
    superEmail &&
    superPass &&
    secretsEqual(email, superEmail) &&
    secretsEqual(password, superPass)
  ) {
    if (!expectedToken) return { ok: false, error: 'admin_token_missing' };
    return { ok: true, token: expectedToken };
  }

  return { ok: false, error: 'unauthorized' };
}
