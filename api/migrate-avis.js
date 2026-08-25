import '../lib/load-env.js';
import { cronSecretOk, json } from '../lib/http.js';
import { avisColumnExists, ensureAvisColumn } from '../lib/supabase-migrate.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method' });
    return;
  }
  if (!cronSecretOk(req)) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }
  const exists = await avisColumnExists();
  if (exists) {
    json(res, 200, { ok: true, avis_column: true });
    return;
  }
  const result = await ensureAvisColumn();
  if (result.ok) {
    json(res, 200, { ok: true, avis_column: true, ...result });
    return;
  }
  json(res, 500, {
    ok: false,
    avis_column: false,
    error: result.error,
    sql: result.sql,
    hint: 'Exécuter supabase/002_avis.sql dans le SQL Editor Supabase',
  });
}
