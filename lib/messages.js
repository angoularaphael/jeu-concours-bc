export function confirmationMessage(prenom) {
  return `Bonjour ${prenom},

Votre inscription au grand jeu concours des 10 ans Boxing Center est bien confirmée.

Vous participez au tirage au sort pour tenter de gagner un abonnement 12 mois d'une valeur de 400 €.

Un gagnant sera tiré au sort chaque soir pendant 10 jours à partir du 01/09/2026.

Bonne chance.

L'équipe BOXING CENTER`;
}

export function invitationMessage({ friendPrenom, referrerPrenom, referrerNom, link }) {
  const who = [referrerPrenom, referrerNom].filter(Boolean).join(' ').trim() || 'un ami';
  return `Bonjour ${friendPrenom},

Grâce à votre ami(e) ${who}, vous avez la chance de participer au grand jeu concours des 10 ans Boxing Center.

Vous pouvez tenter de gagner un abonnement 12 mois d'une valeur de 400 €.

Pour finaliser votre inscription au jeu concours, cliquez ici et remplissez le formulaire :
${link}

Vous pourrez également inviter 2 ami(e)s à participer.

L'équipe BOXING CENTER`;
}
