import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { enterContest, kpis, parseEntry } from '../lib/contest.js';
import { pickAvisSalle, SALLES } from '../lib/salles.js';
import { getContactByPhoneKey, listContacts, resetMemoryStore } from '../lib/store.js';

process.env.LEADS_BACKEND = 'memory';
process.env.DRY_RUN = '1';
delete process.env.WHATSAPP_BOT_URL;
delete process.env.SUPABASE_URL;

const proof =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const valid = {
  prenom: 'Camille',
  nom: 'Durand',
  telephone: '0611111111',
  email: 'camille.durand@example.com',
  consent_age: true,
  consent_reglement: true,
  consent_friends: true,
  consent_privacy: true,
  source: 'story',
  avis: [{ salle: 'st-cyprien', proof }],
  friends: [
    { prenom: 'Leo', nom: 'Martin', telephone: '0622222222', email: 'leo.martin@example.com' },
    { prenom: 'Nina', nom: 'Bernard', telephone: '0633333333', email: 'nina.bernard@example.com' },
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
        { prenom: 'A', nom: 'A', telephone: '0622222222', email: 'a@example.com' },
        { prenom: 'B', nom: 'B', telephone: '0622222222', email: 'b@example.com' },
      ],
    });
    assert.equal(parsed.ok, false);
  });

  it('refuse une inscription sans avis Google', () => {
    const sans = parseEntry({ ...valid, avis: [] });
    assert.equal(sans.ok, false);
    assert.ok(sans.errors.some((e) => e.field === 'avis'));
  });

  it('accepte une inscription avec avis, sans ami(e)s', () => {
    const parsed = parseEntry({ ...valid, friends: [], consent_friends: false });
    assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
    assert.equal(parsed.data.avis.length, 1);
    assert.equal(parsed.data.friends.length, 0);
  });

  it('compte 1 ticket avec avis, 2 tickets avec avis + 2 ami(e)s', async () => {
    const { ticketCount } = await import('../lib/contest.js');
    assert.equal(ticketCount({ avis: [] }), 0);
    assert.equal(ticketCount({ avis: [{ salle: 'st-cyprien' }] }), 1);
    assert.equal(
      ticketCount({
        avis: [{ salle: 'st-cyprien' }],
        friends: [
          { prenom: 'A', nom: 'A', telephone: '0611111112' },
          { prenom: 'B', nom: 'B', telephone: '0611111113' },
        ],
      }),
      2
    );
  });

  it('refuse un avis sans screen', () => {
    const parsed = parseEntry({
      ...valid,
      avis: [{ salle: 'st-cyprien', proof: '' }],
    });
    assert.equal(parsed.ok, false);
  });

  it('limite les avis à Saint-Cyprien, Minimes et Toulouse États-Unis', () => {
    assert.deepEqual(SALLES.map((s) => s.id), ['st-cyprien', 'minimes', 'etats-unis']);
    assert.equal(parseEntry({ ...valid, avis: [{ salle: 'portet', proof }] }).ok, false);
    assert.equal(parseEntry({ ...valid, avis: [{ salle: 'ramonville', proof }] }).ok, false);
    assert.equal(parseEntry({ ...valid, avis: [{ salle: 'st-cyprien', proof }] }).ok, true);
    assert.equal(parseEntry({ ...valid, avis: [{ salle: 'minimes', proof }] }).ok, true);
    assert.equal(parseEntry({ ...valid, avis: [{ salle: 'etats-unis', proof }] }).ok, true);
  });

  it('tire une fiche Boxing Center au hasard (40 % États-Unis, 40 % Saint-Cyprien, 20 % Minimes)', () => {
    assert.equal(pickAvisSalle(() => 0).id, 'etats-unis');
    assert.equal(pickAvisSalle(() => 0.399).id, 'etats-unis');
    assert.equal(pickAvisSalle(() => 0.4).id, 'st-cyprien');
    assert.equal(pickAvisSalle(() => 0.799).id, 'st-cyprien');
    assert.equal(pickAvisSalle(() => 0.8).id, 'minimes');
    assert.equal(pickAvisSalle(() => 0.99).id, 'minimes');
  });

  it('exige le consentement ami(e)s seulement si les 2 sont renseigné(e)s', () => {
    assert.equal(parseEntry({ ...valid, friends: [], consent_friends: false }).ok, true);
    assert.equal(parseEntry({ ...valid, consent_friends: false }).ok, false);
    assert.equal(parseEntry({ ...valid, consent_privacy: false }).ok, false);
  });

  it('refuse un email manquant ou invalide', () => {
    assert.equal(parseEntry({ ...valid, email: '' }).ok, false);
    assert.equal(parseEntry({ ...valid, email: 'pas-un-email' }).ok, false);
    const ok = parseEntry({ ...valid, email: '  Camille.Durand@Example.COM ' });
    assert.equal(ok.ok, true);
    assert.equal(ok.data.email, 'camille.durand@example.com');
  });

  it('accepte un ami(e) sans email', () => {
    const parsed = parseEntry({
      ...valid,
      friends: [
        { prenom: 'Leo', nom: 'Martin', telephone: '0622222222' },
        { prenom: 'Nina', nom: 'Bernard', telephone: '0633333333', email: 'nina.bernard@example.com' },
      ],
    });
    assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
    assert.equal(parsed.data.friends[0].email, '');
    assert.equal(parsed.data.friends[1].email, 'nina.bernard@example.com');
  });

  it('refuse un email ami(e) invalide s’il est renseigné', () => {
    const parsed = parseEntry({
      ...valid,
      friends: [
        { prenom: 'Leo', nom: 'Martin', telephone: '0622222222', email: 'pas-un-email' },
        { prenom: 'Nina', nom: 'Bernard', telephone: '0633333333', email: 'nina.bernard@example.com' },
      ],
    });
    assert.equal(parsed.ok, false);
    assert.ok(parsed.errors.some((e) => e.field === 'ami1_email'));
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
    assert.equal(camille.tickets, 2);
    const leo = await getContactByPhoneKey('622222222');
    assert.equal(leo.email, 'leo.martin@example.com');
  });

  it('inscrit avec avis et sans ami(e)s : 1 ticket', async () => {
    const result = await enterContest(
      {
        ...valid,
        telephone: '0611111199',
        email: 'camille.solo@example.com',
        consent_friends: false,
        friends: [],
      },
      { publicUrl: 'http://127.0.0.1:5620', dryRun: true },
    );
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.friends.length, 0);
    const solo = await getContactByPhoneKey('611111199');
    assert.equal(solo.tickets, 1);
  });

  it('inscrit même si les ami(e)s n’ont pas d’email', async () => {
    const result = await enterContest(
      {
        ...valid,
        telephone: '0611111112',
        email: 'camille2@example.com',
        friends: [
          { prenom: 'Hugo', nom: 'Petit', telephone: '0644444444' },
          { prenom: 'Jade', nom: 'Leroy', telephone: '0655555555' },
        ],
      },
      { publicUrl: 'http://127.0.0.1:5620', dryRun: true },
    );
    assert.equal(result.ok, true, JSON.stringify(result));
    const hugo = await getContactByPhoneKey('644444444');
    assert.equal(hugo.email, null);
    assert.equal(result.friends[0].email_sent, false);
    assert.equal(result.friends[1].email_sent, false);
    const jade = await getContactByPhoneKey('655555555');
    assert.equal(jade.email, null);
  });

  it('détecte un doublon participant mais relance quand même les ami(e)s', async () => {
    const again = await enterContest(valid, {
      publicUrl: 'http://127.0.0.1:5620',
      dryRun: true,
    });
    assert.equal(again.ok, true);
    assert.equal(again.already_registered, true);
    assert.equal(again.friends.length, 2);
    assert.equal(again.friends[0].reason, 'already_invited');
  });

  it('marque un numéro ami invalide sans bloquer l’inscrit', async () => {
    resetMemoryStore();
    const result = await enterContest(
      {
        ...valid,
        telephone: '0644444444',
        friends: [
          { prenom: 'Leo', nom: 'Martin', telephone: '0622222222', email: 'leo.martin@example.com' },
          { prenom: 'Bad', nom: 'Num', telephone: '0000000000', email: 'bad.num@example.com' },
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
        consent_privacy: true,
        avis: [{ salle: 'minimes', proof }],
        friends: [
          { prenom: 'Eve', nom: 'Petit', telephone: '0655555555', email: 'eve.petit@example.com' },
          { prenom: 'Max', nom: 'Leroy', telephone: '0666666666', email: 'max.leroy@example.com' },
        ],
      },
      { publicUrl: 'http://127.0.0.1:5620', dryRun: true }
    );
    assert.equal(second.ok, true, JSON.stringify(second));
    assert.equal(second.participant.status, 'inscription_finalisee');
  });
});

describe('kpis', () => {
  it('compte les contacts générés via invited_by_id même sans ligne concours_invites', () => {
    const inviterId = '11111111-1111-1111-1111-111111111111';
    const inviteeId = '22222222-2222-2222-2222-222222222222';
    const stats = kpis({
      contacts: [
        { id: inviterId, role: 'participant', status: 'inscrit', tickets: 1 },
        { id: inviteeId, role: 'invite', status: 'invite', invited_by_id: inviterId, tickets: 1 },
      ],
      invites: [],
      events: [],
      queue: [],
    });
    assert.equal(stats.generated_by[inviterId], 1);
    assert.equal(stats.amis_invites, 1);
  });

  it('ignore les entrées antérieures à stats_reset_at', () => {
    const since = '2026-09-10T12:00:00.000Z';
    const stats = kpis({
      since,
      contacts: [
        { id: '1', role: 'participant', status: 'inscrit', created_at: '2026-09-09T10:00:00.000Z', tickets: 1 },
        { id: '2', role: 'participant', status: 'inscrit', created_at: '2026-09-10T13:00:00.000Z', tickets: 1 },
      ],
      invites: [],
      events: [
        { type: 'page_vue', created_at: '2026-09-09T10:00:00.000Z' },
        { type: 'page_vue', created_at: '2026-09-10T13:00:00.000Z' },
      ],
      queue: [],
    });
    assert.equal(stats.visitors, 1);
    assert.equal(stats.inscrits, 1);
    assert.equal(stats.contacts_total, 1);
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
