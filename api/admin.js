import '../lib/load-env.js';
import { json, queryFromUrl, readBody } from '../lib/http.js';
import { adminTokenOk, verifyAdminLogin } from '../lib/admin-auth.js';
import { kpis } from '../lib/contest.js';
import { deleteContact, getContactById, listContacts, listEvents, listInvites, listQueueAll } from '../lib/store.js';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseDataImage(proof) {
  const raw = String(proof || '').trim();
  const m = raw.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return null;
  try {
    const buffer = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) return null;
    const mime = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
    return { mime, buffer };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === 'POST') {
    let body = {};
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { ok: false, error: 'invalid_json' });
      return;
    }
    const result = verifyAdminLogin(body);
    if (!result.ok) {
      json(res, 401, { ok: false, error: result.error || 'unauthorized' });
      return;
    }
    json(res, 200, { ok: true, token: result.token });
    return;
  }

  if (req.method === 'DELETE') {
    if (!adminTokenOk(req)) {
      json(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }
    const q = queryFromUrl(req);
    try {
      await deleteContact(q.id);
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 500, { ok: false, error: err.message || 'delete' });
    }
    return;
  }

  if (req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'method' });
    return;
  }
  if (!adminTokenOk(req)) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const q = queryFromUrl(req);

  if (q.id && q.proof != null && q.proof !== '') {
    const idx = Number(q.proof);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) {
      json(res, 400, { ok: false, error: 'proof' });
      return;
    }
    try {
      const contact = await getContactById(q.id);
      const item = Array.isArray(contact?.avis) ? contact.avis[idx] : null;
      const parsed = parseDataImage(item?.proof);
      if (!parsed) {
        json(res, 404, { ok: false, error: 'proof' });
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', parsed.mime);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(parsed.buffer);
    } catch (err) {
      json(res, 500, { ok: false, error: err.message || 'proof' });
    }
    return;
  }

  const filters = {
    status: q.status || undefined,
    source: q.source || undefined,
    from: q.from || undefined,
    to: q.to || undefined,
  };

  const [contacts, invites, events, queue] = await Promise.all([
    listContacts(filters),
    listInvites(),
    listEvents(),
    listQueueAll(),
  ]);

  const stats = kpis({ contacts, invites, events, queue });

  if (q.export === 'csv' || q.action === 'export') {
    const header = [
      'id',
      'prenom',
      'nom',
      'telephone',
      'email',
      'avis',
      'salle',
      'ville',
      'source',
      'role',
      'status',
      'wa_status',
      'wa_error',
      'invited_by_id',
      'created_at',
      'finalized_at',
      'contacts_generes',
    ];
    const lines = [header.join(';')];
    for (const c of contacts) {
      lines.push(
        [
          c.id,
          c.prenom,
          c.nom,
          c.telephone,
          c.email,
          Array.isArray(c.avis) ? c.avis.map((a) => a.salle).filter(Boolean).join('|') : '',
          c.salle,
          c.ville,
          c.source,
          c.role,
          c.status,
          c.wa_status,
          c.wa_error,
          c.invited_by_id,
          c.created_at,
          c.finalized_at,
          stats.generated_by[c.id] || 0,
        ]
          .map(csvEscape)
          .join(';')
      );
    }
    const csv = `\uFEFF${lines.join('\n')}`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="concours-10ans.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.end(csv);
    return;
  }

  json(res, 200, {
    ok: true,
    kpis: stats,
    contacts: contacts.map((c) => ({
      ...c,
      contacts_generes: stats.generated_by[c.id] || 0,
      chance_boost: Array.isArray(c.avis) && c.avis.length > 0,
      avis: Array.isArray(c.avis)
        ? c.avis.map((a) => ({ salle: a.salle, has_proof: Boolean(a.proof) }))
        : [],
    })),
  });
}
