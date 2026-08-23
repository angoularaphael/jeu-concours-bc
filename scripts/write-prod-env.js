/**
 * Génère .env.production (gitignoré) à partir de séance-offerte + jetons concours.
 * Usage : node scripts/write-prod-env.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, '..', 'bc-seance-offerte', '.env');

function parseEnv(raw) {
  const out = {};
  for (const line of String(raw).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const src = parseEnv(readFileSync(sourcePath, 'utf8'));
const token = () => randomBytes(24).toString('base64url');

const body = `# Production Vercel — ne pas committer.
# Coller dans Vercel → Settings → Environment Variables (Production).
# Ne PAS mettre DRY_RUN.

WHATSAPP_BOT_URL=${src.WHATSAPP_BOT_URL || ''}
WHATSAPP_BOT_SECRET=${src.WHATSAPP_BOT_SECRET || ''}

SUPABASE_URL=${src.SUPABASE_URL || ''}
SUPABASE_SERVICE_ROLE_KEY=${src.SUPABASE_SERVICE_ROLE_KEY || ''}

PUBLIC_URL=https://concours.boxingcenter.fr
ADMIN_TOKEN=${token()}
CRON_SECRET=${token()}
`;

const dest = path.join(root, '.env.production');
writeFileSync(dest, body, 'utf8');
console.log('Écrit', dest);
console.log('PUBLIC_URL=https://concours.boxingcenter.fr');
console.log('WhatsApp + Supabase repris de bc-seance-offerte');
console.log('ADMIN_TOKEN et CRON_SECRET générés (voir le fichier)');
