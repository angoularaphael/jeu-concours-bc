const KEY = 'bc-concours-admin';

const login = document.getElementById('login');
const dash = document.getElementById('dash');
const kpisEl = document.getElementById('kpis');
const sourcesEl = document.getElementById('sources');
const rowsEl = document.getElementById('rows');
const loginError = document.getElementById('login-error');
const exportLink = document.getElementById('export');

let lastFilters = {};
const proofModal = document.getElementById('proof-modal');
const proofImg = document.getElementById('proof-img');
const proofCaption = document.getElementById('proof-caption');

function token() {
  return sessionStorage.getItem(KEY) || '';
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function kpiCard(label, value) {
  const div = document.createElement('div');
  div.className = 'kpi';
  div.innerHTML = `<b>${value}</b><span>${label}</span>`;
  return div;
}

async function load(filters = {}) {
  const q = new URLSearchParams({ token: token(), ...filters });
  const res = await fetch(`/api/admin?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'unauthorized');
  kpisEl.replaceChildren(
    kpiCard('Visiteurs', data.kpis.visitors),
    kpiCard('Form. commencés', data.kpis.form_started),
    kpiCard('Form. validés', data.kpis.form_submitted),
    kpiCard('Inscrits', data.kpis.inscrits),
    kpiCard('Avec avis Google', data.kpis.with_avis),
    kpiCard('Tickets chances', data.kpis.tickets_total),
    kpiCard('Ami(e)s invité(e)s', data.kpis.amis_invites),
    kpiCard('Ami(e)s finalisé(e)s', data.kpis.amis_finalises),
    kpiCard('Taux invité→inscrit', `${data.kpis.taux_invite_inscrit} %`),
    kpiCard('WA envoyés', data.kpis.wa_sent),
    kpiCard('Erreurs WA', data.kpis.wa_errors),
    kpiCard('Contacts', data.kpis.contacts_total),
    kpiCard('Doublons', data.kpis.doublons),
  );
  sourcesEl.replaceChildren();
  const bySource = data.kpis.by_source || {};
  const keys = Object.keys(bySource).sort();
  if (!keys.length) {
    sourcesEl.textContent = 'Aucune inscription pour le moment.';
  } else {
    for (const src of keys) {
      sourcesEl.appendChild(kpiCard(src, bySource[src]));
    }
  }
  rowsEl.replaceChildren();
  for (const c of data.contacts) {
    const tr = document.createElement('tr');
    const cells = [
      fmtDate(c.created_at),
      `${c.prenom || ''} ${c.nom || ''}`.trim(),
      c.source || 'direct',
      c.telephone || '',
      c.email || '',
    ];
    for (const v of cells) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tr.appendChild(avisCell(c));
    for (const v of [c.role || '', c.status || '', c.wa_status || '', String(c.contacts_generes || 0)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const act = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-del';
    btn.textContent = 'Supprimer';
    btn.addEventListener('click', () => remove(c.id, `${c.prenom || ''} ${c.nom || ''}`.trim()));
    act.appendChild(btn);
    tr.appendChild(act);
    rowsEl.appendChild(tr);
  }
  exportLink.href = `/api/admin?token=${encodeURIComponent(token())}&export=csv`;
}

function avisCell(c) {
  const td = document.createElement('td');
  const avis = Array.isArray(c.avis) ? c.avis : [];
  if (!avis.length) {
    td.textContent = '—';
    return td;
  }
  const wrap = document.createElement('div');
  wrap.className = 'avis-proofs';
  avis.forEach((a, i) => {
    const salle = a.salle || `avis ${i + 1}`;
    if (!a.has_proof) {
      const span = document.createElement('span');
      span.textContent = salle;
      wrap.appendChild(span);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-proof';
    btn.textContent = `Voir ${salle}`;
    btn.addEventListener('click', () => openProof(c, i));
    wrap.appendChild(btn);
  });
  td.appendChild(wrap);
  return td;
}

function openProof(c, i) {
  if (!proofModal || !proofImg) return;
  const salle = c.avis?.[i]?.salle || '';
  proofCaption.textContent = `${c.prenom || ''} ${c.nom || ''} — ${salle}`.trim();
  proofImg.src = `/api/admin?token=${encodeURIComponent(token())}&id=${encodeURIComponent(c.id)}&proof=${i}`;
  proofImg.alt = `Screen avis Google ${salle}`.trim();
  proofModal.hidden = false;
}

function closeProof() {
  if (!proofModal || !proofImg) return;
  proofModal.hidden = true;
  proofImg.removeAttribute('src');
}

document.getElementById('proof-close')?.addEventListener('click', closeProof);
proofModal?.addEventListener('click', (e) => {
  if (e.target === proofModal) closeProof();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && proofModal && !proofModal.hidden) closeProof();
});

async function remove(id, label) {
  if (!id || !window.confirm(`Supprimer ${label || 'ce contact'} ?`)) return;
  const res = await fetch(`/api/admin?token=${encodeURIComponent(token())}&id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    window.alert(data.error || 'Suppression impossible.');
    return;
  }
  await load(lastFilters);
}

async function loginWith(payload) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(data.error || 'unauthorized');
  sessionStorage.setItem(KEY, data.token);
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const jeton = document.getElementById('token').value.trim();
  try {
    if (email && password) await loginWith({ email, password });
    else if (jeton) await loginWith({ token: jeton });
    else throw new Error('empty');
    await load();
    login.hidden = true;
    dash.hidden = false;
  } catch {
    loginError.hidden = false;
    loginError.textContent = 'Identifiants ou jeton refusés.';
    sessionStorage.removeItem(KEY);
  }
});

document.getElementById('filters').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const filters = {};
  for (const [k, v] of fd.entries()) if (v) filters[k] = v;
  if (filters.from) filters.from = `${filters.from}T00:00:00.000Z`;
  if (filters.to) filters.to = `${filters.to}T23:59:59.999Z`;
  lastFilters = filters;
  await load(filters);
});

if (token()) {
  load()
    .then(() => {
      login.hidden = true;
      dash.hidden = false;
    })
    .catch(() => sessionStorage.removeItem(KEY));
}
