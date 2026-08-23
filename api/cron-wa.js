import '../lib/load-env.js';
import { cronSecretOk, isDryRunRequest, json } from '../lib/http.js';
import { processWaQueue } from '../lib/contest.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method' });
    return;
  }
  if (!cronSecretOk(req)) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }
  const dryRun = isDryRunRequest(req, {});
  const result = await processWaQueue({ dryRun, limit: 30 });
  json(res, 200, { ok: true, ...result });
}
