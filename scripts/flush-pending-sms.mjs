/**
 * Envoie les SMS concours encore en file (pending).
 *   node scripts/flush-pending-sms.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 1) continue;
      let value = t.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[t.slice(0, i).trim()] = value;
    }
  } catch {
    /* missing file */
  }
  return out;
}

const prod = parseEnvFile(path.join(root, '.env.production'));
for (const [key, value] of Object.entries(prod)) {
  if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
}

process.env.SMS_GATEWAY_URL =
  process.env.SMS_GATEWAY_URL || 'http://prem-eu2.bot-hosting.net:21724';
process.env.SMS_GATEWAY_SECRET =
  process.env.SMS_GATEWAY_SECRET || 'sgw-out-8f3Kq2NmP7xR4wL9';
process.env.SMS_GATEWAY_EMAIL =
  process.env.SMS_GATEWAY_EMAIL || 'angoularaphael05@gmail.com';
process.env.SMS_GATEWAY_PASSWORD = process.env.SMS_GATEWAY_PASSWORD || 'Fareno12';
delete process.env.DRY_RUN;
delete process.env.LEADS_BACKEND;

const { processWaQueue } = await import('../lib/contest.js');
const { listQueueAll } = await import('../lib/store.js');

const before = await listQueueAll();
const pendingBefore = before.filter((j) => j.status === 'pending').length;
console.log(
  JSON.stringify({
    start: true,
    queue: before.length,
    pending: pendingBefore,
    sent: before.filter((j) => j.status === 'sent').length,
  })
);

let totalSent = 0;
let totalErrors = 0;
let totalSkipped = 0;
for (let round = 1; round <= 12; round += 1) {
  const result = await processWaQueue({ dryRun: false, limit: 20 });
  totalSent += result.sent || 0;
  totalErrors += result.errors || 0;
  totalSkipped += result.skipped || 0;
  console.log(JSON.stringify({ round, ...result, totalSent, totalErrors, totalSkipped }));
  if (!result.queued) break;
  await new Promise((resolve) => setTimeout(resolve, 400));
}

const after = await listQueueAll();
console.log(
  JSON.stringify({
    done: true,
    sent: totalSent,
    errors: totalErrors,
    skipped: totalSkipped,
    remaining_pending: after.filter((j) => j.status === 'pending').length,
    remaining_skipped: after.filter((j) => j.status === 'skipped').length,
    remaining_sent: after.filter((j) => j.status === 'sent').length,
  })
);
