import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  confirmationEmail,
  invitationEmail,
  shareAskEmail,
  DAVID_FROM_NAME,
} from '../lib/david-email.js';

describe('mails David (Principal, pas Promotions)', () => {
  it('confirmation : expéditeur David, sujet perso, texte brut', () => {
    const mail = confirmationEmail({
      prenom: 'camille',
      publicUrl: 'https://concours.boxingcenter.fr',
    });
    assert.equal(mail.fromName, DAVID_FROM_NAME);
    assert.equal(mail.subject, 'Camille, c’est David');
    assert.equal(mail.html, undefined);
    assert.match(mail.emailText, /C’est David\./);
    assert.match(mail.emailText, /David de Boxing Center/);
    assert.match(mail.emailText, /https:\/\/concours\.boxingcenter\.fr/);
    assert.doesNotMatch(mail.subject, /Boxing Center|concours|€|gagne/i);
  });

  it('invitation et relance partage : même forme que Guillaume en Principal', () => {
    const invite = invitationEmail({
      friendPrenom: 'leo',
      referrerPrenom: 'camille',
      link: 'https://concours.boxingcenter.fr/?inv=abc',
    });
    assert.equal(invite.fromName, 'David');
    assert.match(invite.emailText, /Camille m’a donné ton mail/);
    assert.match(invite.emailText, /\?inv=abc/);
    assert.equal(invite.html, undefined);

    const share = shareAskEmail({ prenom: 'Nina', publicUrl: 'https://concours.boxingcenter.fr/' });
    assert.equal(share.subject, 'Nina, c’est David');
    assert.match(share.emailText, /envoie-leur ça/);
    assert.doesNotMatch(share.subject, /Boxing Center|offres|€/);
  });
});
