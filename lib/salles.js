/** Fiche Google proposée pour l'avis bonus du concours (Saint-Cyprien uniquement). */
export const SALLES = [
  {
    id: 'st-cyprien',
    label: 'Saint-Cyprien',
    maps:
      'https://www.google.com/maps/search/?api=1&query=Boxing+Center%2C+11+rue+Sainte-Lucie%2C+31300+Toulouse',
  },
];

export function salleById(id) {
  return SALLES.find((s) => s.id === id) || null;
}

/** Toujours la fiche Saint-Cyprien (une seule salle pour les avis). */
export function nextAvisSalle(_currentId = '', _random = Math.random) {
  return SALLES[0] || null;
}
