export function confirmationMessage(prenom) {
  return `Bonjour ${prenom},

Votre inscription au jeu concours des 10 ans Boxing Center x Hexagone MMA est bien confirmée.

Vous participez au tirage au sort pour tenter de gagner l'une des 10 places Carré Or Hexagone MMA, d'une valeur de 69 € chacune, pour le Zénith Toulouse Métropole le 25 septembre 2026 (en direct sur RMC).

Le jeu est ouvert du 11/09 au 20/09/2026 inclus. Un gagnant est tiré au sort chaque soir.

Bonne chance.

L'équipe BOXING CENTER`;
}

export function invitationMessage({ friendPrenom, referrerPrenom, referrerNom, link }) {
  const who = [referrerPrenom, referrerNom].filter(Boolean).join(' ').trim() || 'un ami';
  return `Bonjour ${friendPrenom},

Grâce à votre ami(e) ${who}, vous avez la chance de participer au jeu concours des 10 ans Boxing Center x Hexagone MMA.

Vous pouvez tenter de gagner l'une des 10 places Carré Or Hexagone MMA, d'une valeur de 69 € chacune, le 25 septembre 2026 au Zénith Toulouse Métropole.

Pour finaliser votre inscription au jeu concours, cliquez ici et remplissez le formulaire :
${link}

Vous pourrez également laisser un avis Google et, si vous le souhaitez, inviter 2 ami(e)s pour un ticket de plus.

L'équipe BOXING CENTER`;
}
