import '../lib/load-env.js';
import { avisColumnExists, ensureAvisColumn } from '../lib/supabase-migrate.js';

const exists = await avisColumnExists();
if (exists) {
  console.log('[ok] Colonne avis déjà présente.');
  process.exit(0);
}

const result = await ensureAvisColumn();
if (result.ok) {
  console.log('[ok] Migration avis appliquée.');
  process.exit(0);
}

console.log('[!] Colonne avis absente — migration manuelle requise');
console.log('1. Ouvrir https://supabase.com/dashboard/project/ulxtbvxdueolvnjhpzvw/sql');
console.log('2. Coller le contenu de supabase/002_avis.sql');
console.log('3. Exécuter');
if (result.error === 'missing_db_url') {
  console.log('Ou définir SUPABASE_DB_URL puis relancer ce script.');
}
process.exit(1);
