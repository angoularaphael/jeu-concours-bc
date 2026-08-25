import './load-env.js';

const SQL = `
alter table public.concours_contacts
  add column if not exists avis jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
`.trim();

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function supabaseUrl(pathname, query = '') {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/rest/v1/${pathname}${query}`;
}

/** Vérifie si la colonne avis est disponible côté PostgREST. */
export async function avisColumnExists() {
  if (!process.env.SUPABASE_URL) return false;
  const res = await fetch(
    supabaseUrl('concours_contacts', '?select=id,avis&limit=1'),
    { headers: supabaseHeaders() }
  );
  if (!res.ok) {
    const text = await res.text();
    return !text.includes('column concours_contacts.avis does not exist');
  }
  return true;
}

/** Applique la migration avis si SUPABASE_DB_URL / DATABASE_URL est défini. */
export async function ensureAvisColumn() {
  if (await avisColumnExists()) {
    return { ok: true, already: true };
  }
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    return { ok: false, error: 'missing_db_url', sql: SQL };
  }
  let pg;
  try {
    pg = await import('pg');
  } catch {
    return { ok: false, error: 'missing_pg', sql: SQL };
  }
  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
  } finally {
    await client.end();
  }
  if (!(await avisColumnExists())) {
    return { ok: false, error: 'column_still_missing', sql: SQL };
  }
  return { ok: true, migrated: true };
}
