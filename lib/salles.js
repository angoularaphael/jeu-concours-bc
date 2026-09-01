/** Les deux fiches Google proposées pour l'avis bonus du concours. */
export const SALLES = [
  {
    id: 'minimes',
    label: 'Minimes',
    maps: 'https://www.google.com/maps/search/?api=1&query=Boxing%20Center%20Minimes%20Toulouse',
  },
  {
    id: 'st-cyprien',
    label: 'Saint-Cyprien',
    maps: 'https://www.google.com/maps/search/?api=1&query=Boxing%20Center%20Saint-Cyprien%20Toulouse',
  },
];

export function salleById(id) {
  return SALLES.find((s) => s.id === id) || null;
}

/** Première fiche répartie au hasard, puis alternance stricte à chaque clic. */
export function nextAvisSalle(currentId = '', random = Math.random) {
  const currentIndex = SALLES.findIndex((s) => s.id === currentId);
  if (currentIndex >= 0) return SALLES[(currentIndex + 1) % SALLES.length];
  const index = Math.min(SALLES.length - 1, Math.floor(random() * SALLES.length));
  return SALLES[index] || null;
}
