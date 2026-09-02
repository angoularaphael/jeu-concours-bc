/** Mails David : texte brut, expéditeur perso — Gmail Principal, pas Promotions. */
export const DAVID_FROM_NAME = 'David';
export const DAVID_SIGN_OFF = 'David de Boxing Center';

function firstName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .split(/([\s'-]+)/)
    .map((part, i) => {
      if (i % 2 === 1 || !part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

function wrap({ name, lines }) {
  const who = firstName(name);
  const greeting = who ? `Salut ${who},` : 'Salut,';
  const subject = who ? `${who}, c’est David` : 'C’est David';
  return {
    fromName: DAVID_FROM_NAME,
    subject,
    html: undefined,
    emailText: [greeting, '', ...lines, '', 'À plus tard,', DAVID_SIGN_OFF].join('\n'),
    headers: undefined,
    attachments: [],
  };
}

export function confirmationEmail({ prenom, publicUrl }) {
  const link = String(publicUrl || 'https://concours.boxingcenter.fr').replace(/\/$/, '');
  return wrap({
    name: prenom,
    lines: [
      'C’est David. C’est bon, tu es bien inscrit.',
      '',
      'Si tes potes veulent tenter aussi, envoie-leur ça :',
      link,
    ],
  });
}

export function invitationEmail({ friendPrenom, referrerPrenom, link }) {
  const who = firstName(referrerPrenom) || 'un ami';
  return wrap({
    name: friendPrenom,
    lines: [
      `C’est David. ${who} m’a donné ton mail.`,
      '',
      'Si tu veux finaliser, c’est ici :',
      link,
    ],
  });
}

export function shareAskEmail({ prenom, publicUrl }) {
  const link = String(publicUrl || 'https://concours.boxingcenter.fr').replace(/\/$/, '');
  return wrap({
    name: prenom,
    lines: [
      'C’est David. Petit mot pour toi.',
      '',
      'Tu es déjà inscrit. Si tes amis veulent tenter aussi, envoie-leur ça :',
      link,
    ],
  });
}

export function shareAskSms({ prenom, publicUrl }) {
  const name = firstName(prenom) || 'toi';
  const link = String(publicUrl || 'https://concours.boxingcenter.fr').replace(/\/$/, '');
  return `Salut ${name}, c'est David. Tu es deja inscrit. Partage ce lien a tes amis pour qu'ils tentent aussi : ${link}`;
}
