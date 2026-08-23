const KEY = 'bc-concours-src';

function params() {
  return new URLSearchParams(location.search);
}

export function readSource() {
  const p = params();
  const raw = (p.get('src') || p.get('utm_source') || '').toLowerCase().trim();
  if (raw) {
    try { sessionStorage.setItem(KEY, raw); } catch { /* privé */ }
    return raw.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'direct';
  }
  try {
    return (sessionStorage.getItem(KEY) || 'direct').slice(0, 32);
  } catch {
    return 'direct';
  }
}

export function readInviteToken() {
  return (params().get('inv') || params().get('invite') || '').trim();
}

export function track(event, extra = {}) {
  const body = JSON.stringify({
    event,
    src: readSource(),
    utm_source: params().get('utm_source') || '',
    utm_medium: params().get('utm_medium') || '',
    utm_campaign: params().get('utm_campaign') || params().get('c') || '',
    path: location.pathname + location.search,
    ...extra,
  });
  try {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
  } catch {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
}
