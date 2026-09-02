import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { handleInscrire } from '../api/inscrire.js';
import { resetMemoryStore } from '../lib/store.js';

process.env.LEADS_BACKEND = 'memory';
process.env.DRY_RUN = '1';
process.env.PUBLIC_URL = 'http://127.0.0.1:5620';
delete process.env.WHATSAPP_BOT_URL;
delete process.env.SUPABASE_URL;

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    headersSent: false,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(raw) {
      this.headersSent = true;
      this.body = JSON.parse(raw);
    },
  };
}

function mockReq(body, { method = 'POST', url = '/api/inscrire?test=1' } = {}) {
  return {
    method,
    url,
    headers: { host: 'localhost', 'x-dry-run': '1' },
    body,
    async *[Symbol.asyncIterator]() {},
  };
}

const valid = {
  prenom: 'Camille',
  nom: 'Durand',
  telephone: '0677777777',
  email: 'camille.durand@example.com',
  consent_age: true,
  consent_reglement: true,
  consent_friends: true,
  source: 'meta',
  friends: [
    { prenom: 'Leo', nom: 'Martin', telephone: '0688888888', email: 'leo.martin@example.com' },
    { prenom: 'Nina', nom: 'Bernard', telephone: '0699999999', email: 'nina.bernard@example.com' },
  ],
};

describe('POST /api/inscrire', () => {
  before(() => {
    process.env.LEADS_BACKEND = 'memory';
    resetMemoryStore();
  });
  after(() => resetMemoryStore());

  it('400 si formulaire incomplet', async () => {
    const res = mockRes();
    await handleInscrire(mockReq({ prenom: 'Camille' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
  });

  it('200 dry-run : participant + 2 ami(e)s', async () => {
    const res = mockRes();
    await handleInscrire(mockReq(valid), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.ok, true);
    assert.equal(res.body.participant.status, 'inscrit');
    assert.equal(res.body.friends.length, 2);
  });
});

describe('GET /api/admin screen avis', () => {
  before(() => {
    process.env.LEADS_BACKEND = 'memory';
    process.env.ADMIN_TOKEN = 'tok-test';
    resetMemoryStore();
  });
  after(() => resetMemoryStore());

  it('sert la photo d’avis depuis le backoffice', async () => {
    const proof =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const created = mockRes();
    await handleInscrire(
      mockReq({
        ...valid,
        telephone: '0610101010',
        friends: [
          { prenom: 'Leo', nom: 'Martin', telephone: '0610101011', email: 'leo.proof@example.com' },
          { prenom: 'Nina', nom: 'Bernard', telephone: '0610101012', email: 'nina.proof@example.com' },
        ],
        avis: [{ salle: 'minimes', proof }],
      }),
      created
    );
    assert.equal(created.statusCode, 200, JSON.stringify(created.body));

    const { getContactByPhoneKey } = await import('../lib/store.js');
    const contact = await getContactByPhoneKey('610101010');
    assert.ok(contact?.id);

    const { default: handleAdmin } = await import('../api/admin.js');
    const res = {
      statusCode: 0,
      headers: {},
      body: null,
      headersSent: false,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(raw) {
        this.headersSent = true;
        this.body = raw;
      },
    };
    await handleAdmin(
      {
        method: 'GET',
        url: `/api/admin?token=tok-test&id=${contact.id}&proof=0`,
        headers: { host: 'localhost' },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'image/png');
    assert.ok(Buffer.isBuffer(res.body) || res.body?.length > 0);
  });
});
