/**
 * Relance les inscrits 10 ans : mail David (Principal) + SMS si pas d’email.
 * Demande de partager le lien à leurs amis.
 *
 *   node scripts/share-inscrits.mjs           # dry-run
 *   node scripts/share-inscrits.mjs --send    # envoi réel
 */
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = 'https://concours.boxingcenter.fr';
const PAGE = 1000;
const GAP_MS = 450;

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(path.join(ROOT, '.env.production'));
loadEnvFile(path.join(ROOT, '..', 'gestion-manager', '.env'));
loadEnvFile(path.join(ROOT, '..', 'gestion-manager', 'bots', 'deploy', 'email-resend', '.env'));
delete process.env.DRY_RUN;
delete process.env.LEADS_BACKEND;
process.env.DRY_RUN = '0';
process.env.PUBLIC_URL = LIVE;
process.env.RESEND_SENDER_NAME = process.env.RESEND_SENDER_NAME || 'David';
process.env.RESEND_SENDER_EMAIL =
  process.env.RESEND_SENDER_EMAIL || 'no-reply@boxingcenter.fr';

const SEND = process.argv.includes('--send');

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function rest(pathname, query = '') {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/rest/v1/${pathname}${query}`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function listAll(pathname, query) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const url = rest(
      pathname,
      `${query}${query.includes('?') ? '&' : '?'}offset=${offset}&limit=${PAGE}`
    );
    const res = await fetchJson(url, {
      headers: {
        ...supabaseHeaders(),
        Range: `${offset}-${offset + PAGE - 1}`,
      },
    });
    if (!res.ok) throw new Error(`${pathname}: ${res.status} ${String(res.text).slice(0, 180)}`);
    const page = Array.isArray(res.data) ? res.data : [];
    rows.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRegistered(c) {
  return c.status === 'inscrit' || c.status === 'inscription_finalisee';
}

async function main() {
  const { shareAskEmail, shareAskSms } = await import('../lib/david-email.js');
  const { sendDavidMail } = await import('../lib/email.js');
  const { sendWhatsAppMessage } = await import('../lib/whatsapp.js');
  const { isConfigured } = await import('../lib/resend.js');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase production manquant (.env.production)');
  }
  if (SEND && !isConfigured()) {
    throw new Error('RESEND_API_KEY manquant (gestion-manager .env)');
  }

  const contacts = await listAll(
    'concours_contacts',
    '?select=id,prenom,nom,email,telephone,status'
  );
  const already = await listAll(
    'concours_events',
    '?type=eq.share_ask_sent&select=contact_id'
  );
  const done = new Set(already.map((e) => e.contact_id).filter(Boolean));
  const targets = contacts.filter(isRegistered);

  const summary = {
    dry_run: !SEND,
    inscrits: targets.length,
    already: 0,
    email: 0,
    sms: 0,
    skipped: 0,
    errors: 0,
    samples: [],
  };

  for (const c of targets) {
    if (done.has(c.id)) {
      summary.already += 1;
      continue;
    }
    const email = String(c.email || '')
      .trim()
      .toLowerCase();
    const phone = c.telephone;
    const mailCopy = shareAskEmail({ prenom: c.prenom, publicUrl: LIVE });
    const smsCopy = shareAskSms({ prenom: c.prenom, publicUrl: LIVE });

    if (summary.samples.length < 3) {
      summary.samples.push({
        prenom: c.prenom,
        email: email || null,
        phone: phone || null,
        subject: mailCopy.subject,
      });
    }

    if (!SEND) {
      if (email) summary.email += 1;
      else if (phone) summary.sms += 1;
      else summary.skipped += 1;
      continue;
    }

    let sent = false;
    let channel = null;
    let error = null;
    if (email) {
      const out = await sendDavidMail(mailCopy, { to: email, dryRun: false });
      sent = Boolean(out.sent);
      channel = 'email';
      error = out.error || out.reason || null;
      if (sent) summary.email += 1;
    } else if (phone) {
      try {
        const out = await sendWhatsAppMessage(phone, smsCopy, { dryRun: false });
        sent = Boolean(out.sent);
        channel = 'sms';
        error = out.reason || null;
        if (sent) summary.sms += 1;
      } catch (err) {
        error = err.message;
      }
    } else {
      summary.skipped += 1;
      continue;
    }

    if (!sent) {
      summary.errors += 1;
      await fetchJson(rest('concours_events'), {
        method: 'POST',
        headers: supabaseHeaders(),
        body: JSON.stringify({
          id: randomUUID(),
          type: 'share_ask_error',
          source: 'share_inscrits',
          contact_id: c.id,
          meta: { channel, error },
        }),
      });
    } else {
      await fetchJson(rest('concours_events'), {
        method: 'POST',
        headers: supabaseHeaders(),
        body: JSON.stringify({
          id: randomUUID(),
          type: 'share_ask_sent',
          source: 'share_inscrits',
          contact_id: c.id,
          meta: { channel, email: email || null },
        }),
      });
    }
    await sleep(GAP_MS);
  }

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
