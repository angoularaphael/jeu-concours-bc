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
  consent_age: true,
  consent_reglement: true,
  consent_friends: true,
  source: 'meta',
  friends: [
    { prenom: 'Leo', nom: 'Martin', telephone: '0688888888' },
    { prenom: 'Nina', nom: 'Bernard', telephone: '0699999999' },
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
