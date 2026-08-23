import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { enterContest, parseEntry } from '../lib/contest.js';
import { getContactByPhoneKey, listContacts, resetMemoryStore } from '../lib/store.js';

process.env.LEADS_BACKEND = 'memory';
process.env.DRY_RUN = '1';
delete process.env.WHATSAPP_BOT_URL;
delete process.env.SUPABASE_URL;

const valid = {
  prenom: 'Camille',
  nom: 'Durand',
  telephone: '0611111111',
  consent_age: true,
  consent_reglement: true,
  consent_wa: true,
  consent_friends: true,
  source: 'story',
  friends: [
    { prenom: 'Leo', nom: 'Martin', telephone: '0622222222' },
    { prenom: 'Nina', nom: 'Bernard', telephone: '0633333333' },
  ],
};

describe('parseEntry', () => {
  it('refuse un formulaire incomplet', () => {
    const parsed = parseEntry({ prenom: 'Camille' });
    assert.equal(parsed.ok, false);
    assert.ok(parsed.errors.length > 0);
  });

  it('refuse deux amis avec le même numéro', () => {
    const parsed = parseEntry({
      ...valid,
      friends: [
        { prenom: 'A', nom: 'A', telephone: '0622222222' },
        { prenom: 'B', nom: 'B', telephone: '0622222222' },
      ],
    });
    assert.equal(parsed.ok, false);
  });

  it('accepte un email vide et refuse un email invalide', () => {
    const sans = parseEntry(valid);
    assert.equal(sans.ok, true);
    assert.equal(sans.data.email, null);
    const bad = parseEntry({ ...valid, email: 'pas-un-email' });
    assert.equal(bad.ok, false);
    const withMail = parseEntry({ ...valid, email: 'camille@test.fr' });
    assert.equal(withMail.ok, true);
    assert.equal(withMail.data.email, 'camille@test.fr');
  });

  it('compte un ticket par email (participant + ami(e)s)', async () => {
    const { ticketCount } = await import('../lib/contest.js');
    assert.equal(ticketCount({ email: null, friends: [{}, {}] }), 1);
    assert.equal(
      ticketCount({
        email: 'a@b.c',
        friends: [{ email: 'c@d.e' }, { email: 'e@f.g' }],
      }),
      4
    );
  });

  it('accepte l’email optionnel d’un ami(e)', () => {
    const parsed = parseEntry({
      ...valid,
      friends: [
        { prenom: 'Leo', nom: 'Martin', telephone: '0622222222', email: 'leo@test.fr' },
        { prenom: 'Nina', nom: 'Bernard', telephone: '0633333333' },
      ],
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.data.friends[0].email, 'leo@test.fr');
    assert.equal(parsed.data.friends[1].email, null);
  });
});

describe('enterContest', () => {
  before(() => {
    process.env.LEADS_BACKEND = 'memory';
    resetMemoryStore();
  });
  after(() => resetMemoryStore());

  it('inscrit le participant et invite 2 ami(e)s', async () => {
    const result = await enterContest(valid, {
      publicUrl: 'http://127.0.0.1:5620',
      dryRun: true,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.participant.status, 'inscrit');
    assert.equal(result.friends.length, 2);
    assert.equal(result.friends[0].status, 'invite');
    assert.equal(result.friends[1].status, 'invite');
    const all = await listContacts();
    assert.equal(all.length, 3);
  });

  it('détecte un doublon participant', async () => {
    const again = await enterContest(valid, {
      publicUrl: 'http://127.0.0.1:5620',
      dryRun: true,
    });
    assert.equal(again.ok, true);
    assert.equal(again.already_registered, true);
  });

  it('marque un numéro ami invalide sans bloquer l’inscrit', async () => {
    resetMemoryStore();
    const result = await enterContest(
      {
        ...valid,
        telephone: '0644444444',
        friends: [
          { prenom: 'Leo', nom: 'Martin', telephone: '0622222222' },
          { prenom: 'Bad', nom: 'Num', telephone: '0000000000' },
        ],
      },
      { publicUrl: 'http://127.0.0.1:5620', dryRun: true }
    );
    assert.equal(result.ok, true);
    assert.equal(result.friends[1].invalid, true);
    assert.equal(result.friends[1].status, 'numero_invalide');
  });

  it('finalise un ami via le token', async () => {
    resetMemoryStore();
    const first = await enterContest(valid, {
      publicUrl: 'http://127.0.0.1:5620',
      dryRun: true,
    });
    assert.equal(first.ok, true);
    const ami = await getContactByPhoneKey('622222222');
    assert.ok(ami?.invite_token);
    const second = await enterContest(
      {
        prenom: 'Leo',
        nom: 'Martin',
        telephone: '0622222222',
        invite_token: ami.invite_token,
        consent_age: true,
        consent_reglement: true,
        consent_wa: true,
        consent_friends: true,
        friends: [
          { prenom: 'Eve', nom: 'Petit', telephone: '0655555555' },
          { prenom: 'Max', nom: 'Leroy', telephone: '0666666666' },
        ],
      },
      { publicUrl: 'http://127.0.0.1:5620', dryRun: true }
    );
    assert.equal(second.ok, true, JSON.stringify(second));
    assert.equal(second.participant.status, 'inscription_finalisee');
  });
});

describe('verifyAdminLogin', () => {
  it('accepte le jeton ou les identifiants boutique', async () => {
    const { verifyAdminLogin } = await import('../lib/admin-auth.js');
    process.env.ADMIN_TOKEN = 'tok-test';
    process.env.SUPER_ADMIN_EMAIL = 'admin@boxingcenter.fr';
    process.env.SUPER_ADMIN_PASSWORD = 'secret-admin';
    assert.equal(verifyAdminLogin({ token: 'tok-test' }).ok, true);
    assert.equal(verifyAdminLogin({ email: 'admin@boxingcenter.fr', password: 'secret-admin' }).ok, true);
    assert.equal(verifyAdminLogin({ email: 'admin@boxingcenter.fr', password: 'nope' }).ok, false);
  });
});
