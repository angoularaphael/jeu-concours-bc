import { readInviteToken, readSource, track } from './track.js';
import { bindOdds, bootMotion, celebrate } from './motion.js';
import { bindAvis, collectAvis } from './avis.js';

const form = document.getElementById('form');
const errorEl = document.getElementById('form-error');
const confirmEl = document.getElementById('confirm');
const alreadyEl = document.getElementById('already');
const submitBtn = document.getElementById('submit');
const formWrap = document.getElementById('formulaire');

document.getElementById('source').value = readSource();
document.getElementById('invite_token').value = readInviteToken();

track('page_vue');
bootMotion();
bindOdds(form);
bindAvis(form);
bindSteps(form);

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
  document.getElementById('email').value = data.invite.email || '';
  const tel = document.getElementById('telephone');
  tel.value = data.invite.telephone || '';
  tel.readOnly = true;
  if (data.invite.already_registered) {
    formWrap.hidden = true;
    confirmEl.hidden = false;
    alreadyEl.hidden = false;
    celebrate(confirmEl);
  }
}

loadInvite().catch(() => {});

function bindSteps(root) {
  const steps = [...root.querySelectorAll('[data-step]')];
  const nextBtn = document.getElementById('step-next');
  const backBtn = document.getElementById('step-back');
  const submit = document.getElementById('submit');
  const label = document.getElementById('step-label');
  const nameEl = document.getElementById('step-name');
  const lead = document.getElementById('form-lead');
  const pips = document.querySelectorAll('#step-pips i');
  if (!steps.length || !nextBtn || !submit) return;

  let i = 0;
  const titles = steps.map((s) => s.dataset.title || '');
  const leads = steps.map((s) => s.dataset.lead || '');

  const show = (n, dir = 1, { focus = true } = {}) => {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const last = i === steps.length - 1;
    steps.forEach((s, idx) => {
      const on = idx === i;
      s.hidden = !on;
      s.classList.toggle('is-on', on);
      if (on && focus) {
        s.classList.remove('step-in-left', 'step-in-right');
        void s.offsetWidth;
        s.classList.add(dir >= 0 ? 'step-in-right' : 'step-in-left');
      }
    });
    backBtn.hidden = i === 0;
    nextBtn.hidden = last;
    submit.hidden = !last;
    if (label) label.textContent = `Round ${i + 1} / ${steps.length}`;
    if (nameEl) nameEl.textContent = titles[i];
    if (lead && leads[i]) lead.textContent = leads[i];
    pips.forEach((pip, idx) => {
      pip.classList.toggle('is-on', idx <= i);
      pip.classList.toggle('is-done', idx < i);
    });
    if (focus) {
      const first = steps[i].querySelector('input:not([type="hidden"]), select');
      if (first) first.focus({ preventScroll: true });
    }
  };

  const validStep = () => {
    const fields = steps[i].querySelectorAll('input, select, textarea');
    for (const f of fields) {
      if (!f.checkValidity()) {
        f.reportValidity();
        return false;
      }
    }
    return true;
  };

  nextBtn.addEventListener('click', () => {
    if (!validStep()) return;
    show(i + 1, 1);
    root.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  backBtn.addEventListener('click', () => {
    show(i - 1, -1);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.closest('textarea, a, button')) return;
    if (i < steps.length - 1) {
      e.preventDefault();
      nextBtn.click();
    }
  });
  show(0, 1, { focus: false });
}

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
    source: fd.get('source') || readSource(),
    invite_token: fd.get('invite_token') || readInviteToken(),
    consent_age: fd.get('consent_age') === 'on',
    consent_reglement: fd.get('consent_reglement') === 'on',
    consent_friends: fd.get('consent_friends') === 'on',
    avis: collectAvis(form),
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
    celebrate(confirmEl);
    confirmEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    showError('Réseau indisponible. Réessaie dans un instant.');
    submitBtn.disabled = false;
  }
});
