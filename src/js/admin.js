const KEY = 'bc-concours-admin';

const login = document.getElementById('login');
const dash = document.getElementById('dash');
const kpisEl = document.getElementById('kpis');
const rowsEl = document.getElementById('rows');
const loginError = document.getElementById('login-error');
const exportLink = document.getElementById('export');

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
    kpiCard('Ami(e)s invité(e)s', data.kpis.amis_invites),
    kpiCard('Ami(e)s finalisé(e)s', data.kpis.amis_finalises),
    kpiCard('Taux invité→inscrit', `${data.kpis.taux_invite_inscrit} %`),
    kpiCard('WA envoyés', data.kpis.wa_sent),
    kpiCard('Erreurs WA', data.kpis.wa_errors),
    kpiCard('Contacts', data.kpis.contacts_total),
    kpiCard('Doublons', data.kpis.doublons),
  );
  rowsEl.replaceChildren();
  for (const c of data.contacts) {
    const tr = document.createElement('tr');
    const cells = [
      fmtDate(c.created_at),
      `${c.prenom || ''} ${c.nom || ''}`.trim(),
      c.telephone || '',
      c.role || '',
      c.status || '',
      c.wa_status || '',
      c.source || '',
      String(c.contacts_generes || 0),
    ];
    for (const v of cells) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    rowsEl.appendChild(tr);
  }
  exportLink.href = `/api/admin?token=${encodeURIComponent(token())}&export=csv`;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  sessionStorage.setItem(KEY, document.getElementById('token').value);
  try {
    await load();
    login.hidden = true;
    dash.hidden = false;
  } catch (err) {
    loginError.hidden = false;
    loginError.textContent = 'Jeton refusé.';
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
