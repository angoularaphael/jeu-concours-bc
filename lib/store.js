import './load-env.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'store.json');

const empty = () => ({ contacts: [], invites: [], events: [], queue: [] });

let memory = empty();

function backend() {
  if (process.env.LEADS_BACKEND === 'memory') return 'memory';
  if (
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  ) {
    return 'supabase';
  }
  return 'file';
}

async function readFileStore() {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      invites: Array.isArray(parsed.invites) ? parsed.invites : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
    };
  } catch {
    return empty();
  }
}

async function writeFileStore(data) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(data, null, 2), 'utf8');
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  };
}

function supabaseUrl(pathname, query = '') {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/rest/v1/${pathname}${query}`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function load() {
  const kind = backend();
  if (kind === 'memory') return memory;
  if (kind === 'file') return readFileStore();
  return null;
}

async function saveLocal(data) {
  if (backend() === 'memory') {
    memory = data;
    return;
  }
  await writeFileStore(data);
}

export function newId() {
  return randomUUID();
}

export function newToken() {
  return randomBytes(9).toString('base64url');
}

export function resetMemoryStore() {
  memory = empty();
}

export async function getContactByPhoneKey(phoneKey) {
  if (!phoneKey) return null;
  const kind = backend();
  if (kind === 'supabase') {
    const res = await fetchJson(
      supabaseUrl(
        'concours_contacts',
        `?phone_key=eq.${encodeURIComponent(phoneKey)}&select=*&limit=1`
      ),
      { headers: supabaseHeaders() }
    );
    if (!res.ok) throw new Error(`Supabase get phone: ${res.status} ${String(res.text).slice(0, 180)}`);
    return Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
  }
  const data = await load();
  return data.contacts.find((c) => c.phone_key === phoneKey) || null;
}

export async function getContactById(id) {
  if (!id) return null;
  const kind = backend();
  if (kind === 'supabase') {
    const res = await fetchJson(
      supabaseUrl('concours_contacts', `?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
      { headers: supabaseHeaders() }
    );
    if (!res.ok) throw new Error(`Supabase get id: ${res.status}`);
    return Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
  }
  const data = await load();
  return data.contacts.find((c) => c.id === id) || null;
}

export async function getContactByToken(token) {
  if (!token) return null;
  const kind = backend();
  if (kind === 'supabase') {
    const res = await fetchJson(
      supabaseUrl(
        'concours_contacts',
        `?invite_token=eq.${encodeURIComponent(token)}&select=*&limit=1`
      ),
      { headers: supabaseHeaders() }
    );
    if (!res.ok) throw new Error(`Supabase get token: ${res.status}`);
    return Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
  }
  const data = await load();
  return data.contacts.find((c) => c.invite_token === token) || null;
}

export async function upsertContact(contact) {
  const row = {
    ...contact,
    updated_at: new Date().toISOString(),
  };
  if (!row.id) row.id = newId();
  if (!row.created_at) row.created_at = row.updated_at;

  const kind = backend();
  if (kind === 'supabase') {
    const existing = row.id ? await getContactById(row.id) : null;
    if (existing) {
      const patched = await fetchJson(
        supabaseUrl('concours_contacts', `?id=eq.${encodeURIComponent(row.id)}`),
        { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify(row) }
      );
      if (!patched.ok && row.avis?.length) {
        const { avis, ...rest } = row;
        const retry = await fetchJson(
          supabaseUrl('concours_contacts', `?id=eq.${encodeURIComponent(row.id)}`),
          { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify(rest) }
        );
        if (retry.ok) {
          const avisPatch = await fetchJson(
            supabaseUrl('concours_contacts', `?id=eq.${encodeURIComponent(row.id)}`),
            { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify({ avis }) }
          );
          if (!avisPatch.ok) {
            const detail = String(avisPatch.text || '').slice(0, 240);
            throw new Error(
              `Supabase avis: ${avisPatch.status} ${detail} — exécuter supabase/002_avis.sql`
            );
          }
          const next = Array.isArray(avisPatch.data) ? avisPatch.data[0] : avisPatch.data;
          return next || { ...rest, avis };
        }
      }
      if (!patched.ok) throw new Error(`Supabase patch contact: ${patched.status} ${String(patched.text).slice(0, 240)}`);
      const next = Array.isArray(patched.data) ? patched.data[0] : patched.data;
      return next || row;
    }
    const inserted = await fetchJson(supabaseUrl('concours_contacts'), {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(row),
    });
    if (!inserted.ok && row.avis?.length) {
      const { avis, ...rest } = row;
      const retry = await fetchJson(supabaseUrl('concours_contacts'), {
        method: 'POST',
        headers: supabaseHeaders(),
        body: JSON.stringify(rest),
      });
      if (retry.ok) {
        const created = Array.isArray(retry.data) ? retry.data[0] : retry.data;
        const id = created?.id || rest.id;
        const avisPatch = await fetchJson(
          supabaseUrl('concours_contacts', `?id=eq.${encodeURIComponent(id)}`),
          { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify({ avis }) }
        );
        if (!avisPatch.ok) {
          const detail = String(avisPatch.text || '').slice(0, 240);
          throw new Error(
            `Supabase avis: ${avisPatch.status} ${detail} — exécuter supabase/002_avis.sql`
          );
        }
        const next = Array.isArray(avisPatch.data) ? avisPatch.data[0] : avisPatch.data;
        return next || { ...created, avis };
      }
    }
    if (!inserted.ok) throw new Error(`Supabase insert contact: ${inserted.status} ${String(inserted.text).slice(0, 240)}`);
    const created = Array.isArray(inserted.data) ? inserted.data[0] : inserted.data;
    return created || row;
  }

  const data = await load();
  const idx = data.contacts.findIndex((c) => c.id === row.id || c.phone_key === row.phone_key);
  if (idx >= 0) data.contacts[idx] = { ...data.contacts[idx], ...row };
  else data.contacts.push(row);
  await saveLocal(data);
  return row;
}

export async function addInvite({ inviter_id, invitee_id }) {
  const row = {
    id: newId(),
    inviter_id,
    invitee_id,
    created_at: new Date().toISOString(),
  };
  const kind = backend();
  if (kind === 'supabase') {
    const inserted = await fetchJson(supabaseUrl('concours_invites'), {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(row),
    });
    if (!inserted.ok) throw new Error(`Supabase invite: ${inserted.status} ${String(inserted.text).slice(0, 180)}`);
    return row;
  }
  const data = await load();
  const dup = data.invites.find(
    (i) => i.inviter_id === inviter_id && i.invitee_id === invitee_id
  );
  if (!dup) data.invites.push(row);
  await saveLocal(data);
  return row;
}

export async function recordEvent(event) {
  const row = {
    id: newId(),
    type: event.type,
    source: event.source || null,
    contact_id: event.contact_id || null,
    meta: event.meta || {},
    created_at: new Date().toISOString(),
  };
  const kind = backend();
  if (kind === 'supabase') {
    await fetchJson(supabaseUrl('concours_events'), {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(row),
    });
    return row;
  }
  const data = await load();
  data.events.push(row);
  await saveLocal(data);
  return row;
}

export async function enqueueWa(job) {
  const row = {
    id: newId(),
    kind: job.kind,
    contact_id: job.contact_id,
    phone: job.phone,
    message: job.message,
    status: 'pending',
    attempts: 0,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const kind = backend();
  if (kind === 'supabase') {
    const inserted = await fetchJson(supabaseUrl('concours_wa_queue'), {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(row),
    });
    if (!inserted.ok) throw new Error(`Supabase queue: ${inserted.status} ${String(inserted.text).slice(0, 180)}`);
    const created = Array.isArray(inserted.data) ? inserted.data[0] : inserted.data;
    return created || row;
  }
  const data = await load();
  data.queue.push(row);
  await saveLocal(data);
  return row;
}

export async function listPendingWa(limit = 20) {
  const kind = backend();
  if (kind === 'supabase') {
    const res = await fetchJson(
      supabaseUrl(
        'concours_wa_queue',
        `?status=eq.pending&select=*&order=created_at.asc&limit=${limit}`
      ),
      { headers: supabaseHeaders() }
    );
    if (!res.ok) throw new Error(`Supabase queue list: ${res.status}`);
    return Array.isArray(res.data) ? res.data : [];
  }
  const data = await load();
  return data.queue.filter((j) => j.status === 'pending').slice(0, limit);
}

export async function updateQueue(id, patch) {
  const next = { ...patch, updated_at: new Date().toISOString() };
  const kind = backend();
  if (kind === 'supabase') {
    await fetchJson(supabaseUrl('concours_wa_queue', `?id=eq.${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: supabaseHeaders(),
      body: JSON.stringify(next),
    });
    return;
  }
  const data = await load();
  const idx = data.queue.findIndex((j) => j.id === id);
  if (idx >= 0) data.queue[idx] = { ...data.queue[idx], ...next };
  await saveLocal(data);
}

export async function listContacts({ status, source, from, to } = {}) {
  const kind = backend();
  let rows = [];
  if (kind === 'supabase') {
    const params = ['select=*', 'order=created_at.desc'];
    if (status) params.push(`status=eq.${encodeURIComponent(status)}`);
    if (source) params.push(`source=eq.${encodeURIComponent(source)}`);
    const res = await fetchJson(supabaseUrl('concours_contacts', `?${params.join('&')}`), {
      headers: supabaseHeaders(),
    });
    if (!res.ok) throw new Error(`Supabase list: ${res.status} ${String(res.text).slice(0, 180)}`);
    rows = Array.isArray(res.data) ? res.data : [];
  } else {
    const data = await load();
    rows = [...data.contacts];
    if (status) rows = rows.filter((c) => c.status === status);
    if (source) rows = rows.filter((c) => c.source === source);
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  if (from) rows = rows.filter((c) => c.created_at >= from);
  if (to) rows = rows.filter((c) => c.created_at <= to);
  return rows;
}

export async function deleteContact(id) {
  const cid = String(id || '').trim();
  if (!cid) return { ok: false, error: 'id' };
  const kind = backend();
  if (kind === 'supabase') {
    const q = encodeURIComponent(cid);
    await fetchJson(supabaseUrl('concours_invites', `?or=(inviter_id.eq.${q},invitee_id.eq.${q})`), {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    });
    await fetchJson(supabaseUrl('concours_wa_queue', `?contact_id=eq.${q}`), {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    });
    await fetchJson(supabaseUrl('concours_events', `?contact_id=eq.${q}`), {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    });
    await fetchJson(supabaseUrl('concours_contacts', `?invited_by_id=eq.${q}`), {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ invited_by_id: null }),
    });
    const res = await fetchJson(supabaseUrl('concours_contacts', `?id=eq.${q}`), {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    });
    if (!res.ok) throw new Error(`Supabase delete: ${res.status} ${String(res.text).slice(0, 180)}`);
    return { ok: true };
  }
  const data = await load();
  data.invites = data.invites.filter((i) => i.inviter_id !== cid && i.invitee_id !== cid);
  data.queue = data.queue.filter((j) => j.contact_id !== cid);
  data.events = data.events.filter((e) => e.contact_id !== cid);
  data.contacts = data.contacts.filter((c) => c.id !== cid);
  await saveLocal(data);
  return { ok: true };
}

export async function listInvites() {
  const kind = backend();
  if (kind === 'supabase') {
    const res = await fetchJson(supabaseUrl('concours_invites', '?select=*'), {
      headers: supabaseHeaders(),
    });
    if (!res.ok) throw new Error(`Supabase invites: ${res.status}`);
    return Array.isArray(res.data) ? res.data : [];
  }
  const data = await load();
  return data.invites;
}

export async function listEvents() {
  const kind = backend();
  if (kind === 'supabase') {
    const res = await fetchJson(supabaseUrl('concours_events', '?select=*'), {
      headers: supabaseHeaders(),
    });
    if (!res.ok) return [];
    return Array.isArray(res.data) ? res.data : [];
  }
  const data = await load();
  return data.events;
}

export async function listQueueAll() {
  const kind = backend();
  if (kind === 'supabase') {
    const res = await fetchJson(supabaseUrl('concours_wa_queue', '?select=*'), {
      headers: supabaseHeaders(),
    });
    if (!res.ok) return [];
    return Array.isArray(res.data) ? res.data : [];
  }
  const data = await load();
  return data.queue;
}

export async function syncTunnelLead(contact, extra = {}) {
  if (backend() !== 'supabase') return;
  const payload = {
    tunnel: 'concours_10ans',
    prenom: contact.prenom || null,
    nom: contact.nom || null,
    telephone: contact.telephone || null,
    email: contact.email || null,
    salle: contact.salle || null,
    referrer_prenom: extra.referrer_prenom || null,
    referrer_nom: extra.referrer_nom || null,
    referrer_phone: extra.referrer_phone || null,
    meta: {
      concours_id: contact.id,
      role: contact.role,
      status: contact.status,
      source: contact.source,
      ville: contact.ville,
    },
  };
  await fetchJson(supabaseUrl('tunnel_leads'), {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(payload),
  });
}

function avisSalle(contact) {
  const first = Array.isArray(contact?.avis) ? contact.avis.find((a) => a?.salle) : null;
  return first?.salle || contact?.salle || null;
}

export async function syncPortetClient(contact) {
  if (backend() !== 'supabase') return { ok: false, reason: 'no_supabase' };
  const phone = toPortetPhone(contact.telephone);
  const email = String(contact.email || '').trim().toLowerCase() || null;
  if (!phone && !email) return { ok: false, reason: 'no_contact' };

  const existingId = await findPortetClientId({ phone: contact.telephone, email });
  const salle = salleLabel(avisSalle(contact));
  const offre = offerTag(contact);
  const core = {
    prenom: contact.prenom || null,
    nom: contact.nom || null,
    telephone: phone || contact.telephone || null,
    email,
    salle,
  };
  const now = new Date().toISOString();

  if (existingId) {
    const patchAttempts = [
      { ...core, source: 'concours', offre, ville: contact.ville || null, updated_at: now },
      { ...core, source: 'concours', offre, updated_at: now },
      { ...core, source: 'concours', updated_at: now },
      { ...core, updated_at: now },
    ];
    for (const body of patchAttempts) {
      const patch = await fetchJson(
        supabaseUrl('portet_clients', `?id=eq.${encodeURIComponent(existingId)}`),
        { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify(body) }
      );
      if (patch.ok) return { ok: true, updated: true, id: existingId, source: body.source || null };
    }
    return { ok: false, reason: 'update_failed', id: existingId };
  }

  const attempts = [
    { ...core, source: 'concours', offre, ville: contact.ville || null, created_at: now, updated_at: now },
    { ...core, source: 'concours', offre, created_at: now, updated_at: now },
    { ...core, source: 'concours', created_at: now, updated_at: now },
    { ...core, source: 'boxplus', offre, created_at: now, updated_at: now },
    { ...core, source: 'manual', created_at: now, updated_at: now },
  ];
  let last = null;
  for (const row of attempts) {
    const res = await fetchJson(supabaseUrl('portet_clients'), {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(row),
    });
    last = res;
    if (res.ok) {
      const created = Array.isArray(res.data) ? res.data[0] : res.data;
      return { ok: true, created: true, id: created?.id || null, source: row.source };
    }
  }
  const detail = String(last?.text || last?.status || '').slice(0, 240);
  return { ok: false, reason: 'insert_failed', detail };
}

const SALLE_LABELS = {
  minimes: 'Les Minimes',
  ramonville: 'Ramonville',
  'st-cyprien': 'Saint-Cyprien',
  portet: 'Portet-sur-Garonne',
  'etats-unis': 'États-Unis',
  balma: 'Balma',
};

function salleLabel(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return SALLE_LABELS[key] || value;
}

function offerTag(contact) {
  const src = String(contact.source || 'direct').slice(0, 32);
  return src && src !== 'direct' ? `concours_10ans:${src}` : 'concours_10ans';
}

function toPortetPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('33') && digits.length >= 11) return `0${digits.slice(-9)}`;
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 9 && /^[1-9]/.test(digits)) return `0${digits}`;
  return null;
}

function phoneLookupVariants(value) {
  const national = toPortetPhone(value);
  const raw = String(value || '').replace(/\D/g, '');
  const set = new Set();
  if (national) {
    set.add(national);
    set.add(national.slice(1));
    set.add(`33${national.slice(1)}`);
    set.add(`+33${national.slice(1)}`);
  }
  if (raw) set.add(raw);
  return [...set];
}

async function findPortetClientId({ phone, email }) {
  if (email) {
    const res = await fetchJson(
      supabaseUrl('portet_clients', `?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`),
      { headers: supabaseHeaders() }
    );
    if (Array.isArray(res.data) && res.data[0]?.id) return res.data[0].id;
  }
  const variants = phoneLookupVariants(phone);
  if (!variants.length) return null;
  const list = variants.map((v) => `"${v.replace(/"/g, '')}"`).join(',');
  const res = await fetchJson(
    supabaseUrl('portet_clients', `?telephone=in.(${list})&select=id&limit=1`),
    { headers: supabaseHeaders() }
  );
  if (Array.isArray(res.data) && res.data[0]?.id) return res.data[0].id;
  return null;
}
