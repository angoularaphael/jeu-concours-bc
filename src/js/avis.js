import { SALLES } from '../../lib/salles.js';

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

function usedSalles(root) {
  return [...root.querySelectorAll('[name^="avis_salle_"]')]
    .map((el) => el.value)
    .filter(Boolean);
}

function pickSalle(except) {
  const pool = SALLES.filter((s) => !except.includes(s.id));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
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

    draw.addEventListener('click', () => {
      const except = usedSalles(form).filter((id) => id !== salleInput.value);
      const salle = pickSalle(except);
      if (!salle) return;
      salleInput.value = salle.id;
      proofInput.value = '';
      nameEl.textContent = `Boxing Center ${salle.label}`;
      link.href = salle.maps;
      picked.hidden = false;
      ok.hidden = true;
      draw.textContent = 'Tirer une autre salle';
      form.dispatchEvent(new Event('odds-refresh'));
      window.open(salle.maps, '_blank', 'noopener');
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
  return [0, 1, 2]
    .map((i) => ({
      salle: form.elements[`avis_salle_${i}`]?.value || '',
      proof: form.elements[`avis_proof_${i}`]?.value || '',
    }))
    .filter((a) => a.salle && a.proof);
}
