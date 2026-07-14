// One-time database setup, driven by the pg client (a project dependency) — no
// psql, no bash, no Prisma migration engine, cross-platform.
//
//   pnpm run db:init
//
// Creates the schema (init.sql) only when the database is empty, then applies
// the idempotent taxonomy / certification / admin seeds. Safe to re-run: an
// already-populated database keeps its data (init.sql, which is destructive, is
// skipped once the schema exists).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

// DATABASE_URL: prefer the environment, then the value the API itself uses
// (apps/api/.env), then a sensible local default.
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(here('../.env'), 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.trim().startsWith('DATABASE_URL='));
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  } catch {
    /* no apps/api/.env — fall through to the default */
  }
  return 'postgresql://cotailor:cotailor@127.0.0.1:5432/cotailor';
}

const SCHEMA_FILE = 'init.sql';
// Note: cert-catalog.sql is intentionally omitted — it's the pre-migration seed
// (singular `category` column) and is incompatible with init.sql's current schema
// (`categories[]`). cert-catalog-multicat.sql is the complete, current upsert.
const SEED_FILES = [
  'taxonomy.sql',
  'family.sql',
  'family-seed.sql',
  'cert-catalog-multicat.sql',
  'seed-admin.sql',
];

async function main() {
  const connectionString = resolveDatabaseUrl();
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT to_regclass('public."User"') AS t`);
    if (rows[0]?.t != null) {
      console.log('→ schema present; skipping init.sql (destructive), applying seeds only');
    } else {
      console.log('→ empty database; applying schema (init.sql)');
      await client.query(readFileSync(here(`./${SCHEMA_FILE}`), 'utf8'));
    }
    for (const f of SEED_FILES) {
      console.log(`→ applying ${f}`);
      await client.query(readFileSync(here(`./${f}`), 'utf8'));
    }
    const { rows: users } = await client.query('SELECT email, role, status FROM "User" ORDER BY "createdAt"');
    console.log(`\n✓ database ready — ${users.length} user(s):`);
    for (const u of users) console.log(`   ${u.email}  ·  ${u.role}  ·  ${u.status}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`\n✗ db:init failed: ${e?.message || e}`);
  process.exit(1);
});
