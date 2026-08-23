function fixDoubledPhone(digits) {
  if (digits.length < 16 || digits.length % 2 !== 0) return null;
  const half = digits.length / 2;
  if (digits.slice(0, half) === digits.slice(half)) return digits.slice(0, half);
  return null;
}

function looksLikeDatePhone(digits) {
  if (digits.length !== 8) return false;
  if (!/^(19|20)\d{6}$/.test(digits)) return false;
  const month = parseInt(digits.slice(4, 6), 10);
  const day = parseInt(digits.slice(6, 8), 10);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return true;
  const yearA = parseInt(digits.slice(0, 4), 10);
  const yearB = parseInt(digits.slice(4), 10);
  return yearA >= 1900 && yearA <= 2100 && yearB >= 1900 && yearB <= 2100;
}

function looksLikeIsbn(digits) {
  if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) return true;
  if (digits.length === 10 && digits.startsWith('978')) return true;
  return false;
}

function looksLikeScrapedGarbage(digits) {
  if (digits.length >= 12 && /^20[12]\d/.test(digits)) return true;
  if (digits.length >= 12 && new Set(digits).size <= 4) return true;
  if (digits.length >= 11 && (digits.startsWith('0000') || digits.startsWith('1111'))) return true;
  return false;
}

export function validatePhoneDigits(digits) {
  if (!digits) return '';
  let normalized = String(digits).replace(/\D/g, '');
  if (normalized.startsWith('00')) normalized = normalized.slice(2);

  const doubled = fixDoubledPhone(normalized);
  if (doubled) normalized = doubled;

  if (looksLikeDatePhone(normalized)) return '';
  if (looksLikeIsbn(normalized)) return '';
  if (looksLikeScrapedGarbage(normalized)) return '';
  if (normalized.length > 15 || normalized.length < 10) return '';
  if (new Set(normalized).size <= 2) return '';

  return normalized;
}

export function normalizePhone(input) {
  if (!input) return '';
  const raw = String(input).split('@')[0].split(':')[0];
  return validatePhoneDigits(raw) || '';
}

export function toWhatsAppDigits(input) {
  const digits = String(input || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
  if (!digits) return '';
  let normalized = digits;
  if (normalized.startsWith('00')) normalized = normalized.slice(2);
  if (normalized.length === 10 && normalized.startsWith('0')) {
    return `33${normalized.slice(1)}`;
  }
  if (normalized.length === 9 && /^[1-9]/.test(normalized)) {
    return `33${normalized}`;
  }
  if (normalized.startsWith('33') && normalized.length >= 11) {
    return normalized;
  }
  return normalized;
}

/** Clé de dédoublonnage : 9 derniers chiffres d’un numéro déjà validé. */
export function phoneKey(input) {
  const valid = normalizePhone(input);
  if (!valid) return '';
  const wa = toWhatsAppDigits(valid);
  return (wa || valid).slice(-9);
}

export function isValidPhone(input) {
  return Boolean(normalizePhone(input));
}
