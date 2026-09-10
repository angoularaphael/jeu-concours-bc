import { boxingCenterLabel, pickAvisSalle } from '../../lib/salles.js';

function applySalleToCard(form, card, salle) {
  const i = card.dataset.avis;
  const nameEl = card.querySelector('.avis-name');
  const link = card.querySelector('.avis-link');
  const salleInput = form.elements[`avis_salle_${i}`];
  const proofInput = form.elements[`avis_proof_${i}`];
  if (!salle || !salleInput) return;
  salleInput.value = salle.id;
  if (proofInput) proofInput.value = '';
  if (nameEl) nameEl.textContent = boxingCenterLabel(salle);
  if (link) link.href = salle.maps;
}

export function syncAvisSalleCopy(salle) {
  if (!salle) return;
  const label = boxingCenterLabel(salle);
  document.querySelectorAll('[data-avis-salle-name]').forEach((el) => {
    el.textContent = label;
  });
  const stepAvis = document.getElementById('step-avis');
  if (stepAvis) {
    stepAvis.dataset.lead = `Avis Google obligatoire. Ouvre la fiche ${label}, dépose l’avis, charge le screen. 1 ticket.`;
  }
}

async function fileToProof(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1080;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.72);
}

export function bindAvis(form) {
  if (!form) return;
  form.querySelectorAll('.avis-card').forEach((card) => {
    const i = card.dataset.avis;
    const draw = card.querySelector('.avis-draw');
    const picked = card.querySelector('.avis-picked');
    const nameEl = card.querySelector('.avis-name');
    const link = card.querySelector('.avis-link');
    const file = card.querySelector('.avis-file');
    const ok = card.querySelector('.avis-ok');
    const salleInput = form.elements[`avis_salle_${i}`];
    const proofInput = form.elements[`avis_proof_${i}`];
    if (!draw || !salleInput) return;

    const showSalle = (salle) => {
      if (!salle) return;
      applySalleToCard(form, card, salle);
      syncAvisSalleCopy(salle);
      picked.hidden = false;
      ok.hidden = true;
      draw.textContent = 'Rouvrir la fiche Google';
      form.dispatchEvent(new Event('odds-refresh'));
    };

    const assignedSalle = pickAvisSalle();
    syncAvisSalleCopy(assignedSalle);

    draw.addEventListener('click', () => {
      showSalle(assignedSalle);
      window.open(assignedSalle.maps, '_blank', 'noopener');
    });

    file?.addEventListener('change', async () => {
      const blob = file.files?.[0];
      if (!blob) {
        proofInput.value = '';
        ok.hidden = true;
        form.dispatchEvent(new Event('odds-refresh'));
        return;
      }
      try {
        if (!salleInput.value && assignedSalle) {
          applySalleToCard(form, card, assignedSalle);
          syncAvisSalleCopy(assignedSalle);
          picked.hidden = false;
        }
        proofInput.value = await fileToProof(blob);
        ok.hidden = false;
      } catch {
        proofInput.value = '';
        ok.hidden = true;
        window.alert('Image illisible. Réessaie avec un autre screen.');
      }
      form.dispatchEvent(new Event('odds-refresh'));
    });
  });
}

export function collectAvis(form) {
  return [0]
    .map((i) => ({
      salle: form.elements[`avis_salle_${i}`]?.value || '',
      proof: form.elements[`avis_proof_${i}`]?.value || '',
    }))
    .filter((a) => a.salle && a.proof);
}
