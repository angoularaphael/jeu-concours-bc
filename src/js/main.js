import { readInviteToken, readSource, track } from './track.js';

const form = document.getElementById('form');
const errorEl = document.getElementById('form-error');
const confirmEl = document.getElementById('confirm');
const alreadyEl = document.getElementById('already');
const submitBtn = document.getElementById('submit');
const formWrap = document.getElementById('formulaire');

document.getElementById('source').value = readSource();
document.getElementById('invite_token').value = readInviteToken();

track('page_vue');

let started = false;
form.addEventListener('focusin', () => {
  if (started) return;
  started = true;
  track('form_start');
}, { once: true });

async function loadInvite() {
  const token = readInviteToken();
  if (!token) return;
  const res = await fetch(`/api/invite?token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!data.ok || !data.invite) return;
  document.getElementById('form-title').textContent = 'Je finalise mon inscription';
  document.getElementById('form-lead').textContent =
    `${data.invite.prenom || 'Tu'} as été invité(e). Vérifie tes infos, puis désigne 2 ami(e)s.`;
  document.getElementById('prenom').value = data.invite.prenom || '';
  document.getElementById('nom').value = data.invite.nom || '';
  const tel = document.getElementById('telephone');
  tel.value = data.invite.telephone || '';
  tel.readOnly = true;
  if (data.invite.already_registered) {
    formWrap.hidden = true;
    confirmEl.hidden = false;
    alreadyEl.hidden = false;
  }
}

loadInvite().catch(() => {});

function showError(msg) {
  errorEl.hidden = false;
  errorEl.textContent = msg;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  if (!form.reportValidity()) return;

  const fd = new FormData(form);
  const payload = {
    prenom: fd.get('prenom'),
    nom: fd.get('nom'),
    telephone: fd.get('telephone'),
    email: fd.get('email'),
    salle: fd.get('salle'),
    ville: fd.get('ville'),
    source: fd.get('source') || readSource(),
    invite_token: fd.get('invite_token') || readInviteToken(),
    consent_age: fd.get('consent_age') === 'on',
    consent_reglement: fd.get('consent_reglement') === 'on',
    consent_wa: fd.get('consent_wa') === 'on',
    consent_friends: fd.get('consent_friends') === 'on',
    friends: [
      {
        prenom: fd.get('ami1_prenom'),
        nom: fd.get('ami1_nom'),
        telephone: fd.get('ami1_telephone'),
      },
      {
        prenom: fd.get('ami2_prenom'),
        nom: fd.get('ami2_nom'),
        telephone: fd.get('ami2_telephone'),
      },
    ],
  };

  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/inscrire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showError(data.error || 'Impossible d’enregistrer. Vérifie les champs.');
      submitBtn.disabled = false;
      return;
    }
    track('form_submit', { already: Boolean(data.already_registered) });
    formWrap.hidden = true;
    confirmEl.hidden = false;
    if (data.already_registered) alreadyEl.hidden = false;
    confirmEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    showError('Réseau indisponible. Réessaie dans un instant.');
    submitBtn.disabled = false;
  }
});
