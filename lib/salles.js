/** Fiches Google : Saint-Cyprien, Minimes et Toulouse États-Unis, à tour de rôle. */
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

/** Première fiche répartie au hasard, puis alternance stricte à chaque clic. */
export function nextAvisSalle(currentId = '', random = Math.random) {
  const currentIndex = SALLES.findIndex((s) => s.id === currentId);
  if (currentIndex >= 0) return SALLES[(currentIndex + 1) % SALLES.length];
  const index = Math.min(SALLES.length - 1, Math.floor(random() * SALLES.length));
  return SALLES[index] || null;
}
