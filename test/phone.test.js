import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidPhone, normalizePhone, phoneKey, toWhatsAppDigits } from '../lib/phone.js';

describe('phone', () => {
  it('normalise un 06 français', () => {
    assert.equal(toWhatsAppDigits('06 12 34 56 78'), '33612345678');
    assert.equal(phoneKey('0612345678'), '612345678');
    assert.equal(isValidPhone('0612345678'), true);
  });

  it('rejette un numéro poubelle', () => {
    assert.equal(normalizePhone('0000000000'), '');
    assert.equal(isValidPhone('abc'), false);
  });
});
