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
  email: 'camille.durand@example.com',
  consent_age: true,
  consent_reglement: true,
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

  it('accepte une inscription sans avis et compte +1 ticket par avis', () => {
    const sans = parseEntry(valid);
    assert.equal(sans.ok, true);
    assert.equal(sans.data.avis.length, 0);
    const proof = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const withAvis = parseEntry({
      ...valid,
      avis: [
        { salle: 'minimes', proof },
        { salle: 'portet', proof },
      ],
    });
    assert.equal(withAvis.ok, true, JSON.stringify(withAvis.errors));
    assert.equal(withAvis.data.avis.length, 2);
  });

  it('compte un ticket par avis Google (max x4)', async () => {
    const { ticketCount } = await import('../lib/contest.js');
    assert.equal(ticketCount({ avis: [] }), 1);
    assert.equal(
      ticketCount({
        avis: [{ salle: 'minimes' }, { salle: 'portet' }, { salle: 'st-cyprien' }],
      }),
      4
    );
  });

  it('refuse un avis sans screen', () => {
    const parsed = parseEntry({
      ...valid,
      avis: [{ salle: 'minimes', proof: '' }],
    });
    assert.equal(parsed.ok, false);
  });

  it('refuse un email manquant ou invalide', () => {
    assert.equal(parseEntry({ ...valid, email: '' }).ok, false);
    assert.equal(parseEntry({ ...valid, email: 'pas-un-email' }).ok, false);
    const ok = parseEntry({ ...valid, email: '  Camille.Durand@Example.COM ' });
    assert.equal(ok.ok, true);
    assert.equal(ok.data.email, 'camille.durand@example.com');
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
    const camille = await getContactByPhoneKey('611111111');
    assert.equal(camille.email, 'camille.durand@example.com');
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
        email: 'leo.martin@example.com',
        invite_token: ami.invite_token,
        consent_age: true,
        consent_reglement: true,
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
