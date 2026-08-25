const MARK =
  '<img src="/img/google-logo.svg" alt="" class="google-mark" width="18" height="18" decoding="async" />';

/** Mot « Google » avec logo inline — à réutiliser partout dans l’UI. */
export function googleWord() {
  return `<span class="google-brand">Google${MARK}</span>`;
}

export function withGoogle(before = '', after = '') {
  return `${before}${googleWord()}${after}`;
}

export function setGoogleLabel(el, before = '', after = '') {
  if (!el) return;
  el.innerHTML = withGoogle(before, after);
}

export function initGoogleBrands(root = document) {
  root.querySelectorAll('[data-google-before]').forEach((el) => {
    setGoogleLabel(el, el.dataset.googleBefore || '', el.dataset.googleAfter || '');
  });
}
