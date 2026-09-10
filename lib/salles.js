/** Fiches Google Boxing Center : Saint-Cyprien, Minimes et Toulouse États-Unis. */
export const SALLES = [
  {
    id: 'st-cyprien',
    label: 'Saint-Cyprien',
    maps:
      'https://www.google.com/maps/search/?api=1&query=Boxing+Center+Saint-Cyprien%2C+11+rue+Sainte-Lucie%2C+31300+Toulouse',
  },
  {
    id: 'minimes',
    label: 'Minimes',
    maps:
      'https://www.google.com/maps/search/?api=1&query=Boxing+Center+Minimes%2C+12+rue+de+Fenouillet%2C+31200+Toulouse',
  },
  {
    id: 'etats-unis',
    label: 'Toulouse États-Unis',
    maps:
      'https://www.google.com/maps/search/?api=1&query=Boxing+Center+Toulouse+Etats-Unis%2C+388+avenue+des+Etats-Unis%2C+31200+Toulouse',
  },
];

export function salleById(id) {
  return SALLES.find((s) => s.id === id) || null;
}

/** Tirage pondéré : 40 % États-Unis, 40 % Saint-Cyprien, 20 % Minimes. */
export function pickAvisSalle(random = Math.random) {
  const r = random();
  if (r < 0.4) return salleById('etats-unis');
  if (r < 0.8) return salleById('st-cyprien');
  return salleById('minimes');
}

/** @deprecated Utiliser pickAvisSalle — conservé pour compat tests legacy. */
export function nextAvisSalle(currentId = '', random = Math.random) {
  if (!currentId) return pickAvisSalle(random);
  const currentIndex = SALLES.findIndex((s) => s.id === currentId);
  if (currentIndex >= 0) return SALLES[(currentIndex + 1) % SALLES.length];
  return pickAvisSalle(random);
}

export function boxingCenterLabel(salle) {
  if (!salle) return 'Boxing Center';
  return `Boxing Center ${salle.label}`;
}
