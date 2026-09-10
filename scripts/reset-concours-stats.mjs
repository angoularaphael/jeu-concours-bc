#!/usr/bin/env node
import '../lib/load-env.js';
import { getStatsResetAt, resetContestStats } from '../lib/store.js';

const before = await getStatsResetAt();
const at = await resetContestStats();
console.log(JSON.stringify({ ok: true, before, stats_reset_at: at }, null, 2));
