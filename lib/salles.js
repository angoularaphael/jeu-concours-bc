/** Les 5 salles du concours — fiches Google Maps (recherche officielle). */
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
  {
    id: 'ramonville',
    label: 'Ramonville',
    maps: 'https://www.google.com/maps/search/?api=1&query=Boxing%20Center%20Ramonville',
  },
  {
    id: 'etats-unis',
    label: 'États-Unis',
    maps: 'https://www.google.com/maps/search/?api=1&query=Boxing%20Center%20Etats-Unis%20Toulouse',
  },
  {
    id: 'portet',
    label: 'Portet',
    maps: 'https://www.google.com/maps/search/?api=1&query=Boxing%20Center%20Portet-sur-Garonne',
  },
];

export function salleById(id) {
  return SALLES.find((s) => s.id === id) || null;
}
