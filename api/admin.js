import '../lib/load-env.js';
import { adminTokenOk, json, queryFromUrl } from '../lib/http.js';
import { kpis } from '../lib/contest.js';
import { listContacts, listEvents, listInvites, listQueueAll } from '../lib/store.js';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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
  if (!adminTokenOk(req)) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const q = queryFromUrl(req);
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
    })),
  });
}
