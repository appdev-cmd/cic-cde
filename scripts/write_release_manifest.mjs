import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';

const commit = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync('apps/desktop/dist/release-manifest.json', JSON.stringify({
  commit, builtAt: new Date().toISOString(),
  contractVersion: 1,
  migrations: readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort(),
  edgeFunctions: { 'cde-accounts': { expectedVersion: 4 } },
  environment: process.env.VERCEL_ENV || 'local',
  legacyRevisionPolicy: 'Preserve stored Rxx and document history',
  databaseChangesAppliedByBuild: false,
}, null, 2) + '\n');
