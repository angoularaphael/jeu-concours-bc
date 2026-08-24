import '../lib/load-env.js';
import { json, queryFromUrl } from '../lib/http.js';
import { getContactByToken } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'method' });
    return;
  }
  const q = queryFromUrl(req);
  const token = String(q.token || q.inv || '').trim();
  if (!token) {
    json(res, 400, { ok: false, error: 'token manquant' });
    return;
  }
  const contact = await getContactByToken(token);
  if (!contact) {
    json(res, 404, { ok: false, error: 'invitation introuvable' });
    return;
  }
  json(res, 200, {
    ok: true,
    invite: {
      prenom: contact.prenom,
      nom: contact.nom,
      telephone: contact.telephone,
      email: contact.email || '',
      status: contact.status,
      already_registered: contact.status === 'inscrit' || contact.status === 'inscription_finalisee',
    },
  });
}
