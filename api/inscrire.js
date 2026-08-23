import '../lib/load-env.js';
import { isDryRunRequest, json, publicUrl, readBody } from '../lib/http.js';
import { enterContest } from '../lib/contest.js';

export async function handleInscrire(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method' });
    return;
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    json(res, 400, { ok: false, error: 'JSON invalide' });
    return;
  }

  const dryRun = isDryRunRequest(req, body);
  const result = await enterContest(body, { publicUrl: publicUrl(), dryRun });
  if (!result.ok) {
    json(res, result.status || 400, {
      ok: false,
      error: result.errors?.[0]?.message || 'Formulaire incomplet',
      errors: result.errors,
    });
    return;
  }
  json(res, 200, result);
}

export default async function handler(req, res) {
  try {
    await handleInscrire(req, res);
  } catch (err) {
    if (!res.headersSent) {
      json(res, 500, { ok: false, error: err.message || 'Erreur serveur' });
    }
  }
}
