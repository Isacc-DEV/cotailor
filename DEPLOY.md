# Deploying CoTailor

One command brings up the whole app (API + web + admin), with the database
schema, reference data, and an admin account all seeded.

## Prerequisites (on the target machine)

- **Node.js 20+**
- **pnpm** (`npm i -g pnpm`)
- **PostgreSQL** running and reachable, with an empty database created
- **psql** client on PATH (ships with PostgreSQL)

## Deploy

```bash
cp .env.deploy.example .env.deploy
#   → set DATABASE_URL to your Postgres
#   → if this is a public server, set NEXT_PUBLIC_API_URL to your API's domain

bash deploy.sh
```

That single command installs dependencies, builds all three apps, bootstraps
and seeds the database, then starts everything:

| App   | URL                     |
|-------|-------------------------|
| Web   | http://localhost:3000   |
| Admin | http://localhost:3002   |
| API   | http://localhost:3001   (health: `GET /health`) |

### Seeded admin

```
Email:    wrenikey.dev@gmail.com
Password: Welcome2024!
```

Active and ready — sign in at the admin app immediately, then change the
password (Settings). The email is also kept in `ADMIN_EMAILS`, so it is always
re-promoted to an active admin on sign-in as a safety net.

## Subcommands

```bash
bash deploy.sh setup   # install + build + DB, but don't start
bash deploy.sh db      # (re)apply schema + seeds only
bash deploy.sh start   # start the apps only (already set up)
```

Re-running is safe: the destructive schema (`init.sql`) is applied only when the
database is empty; taxonomy, certifications, and the admin seed are all
idempotent.

## Notes

- **Secrets** — `JWT_SECRET` is auto-generated on first run and saved to
  `.env.deploy` so sessions survive restarts. Keep that file out of version
  control (it is gitignored).
- **LLM provider** — defaults to `stub` (offline, no keys, canned responses).
  Set `LLM_PROVIDER` + the matching key in `.env.deploy` to use a real provider.
- **Running as a service** — `deploy.sh start` runs the apps in the foreground.
  On a real server run it under a process manager (systemd, pm2, or
  `nohup bash deploy.sh start &`) so they survive logout/reboot.
- **Database schema** — this uses the checked-in SQL (`apps/api/prisma/*.sql`)
  via `psql`, which needs no Prisma migration engine. If your environment
  supports it, `pnpm --filter @cotailor/api exec prisma db push` is an
  alternative that syncs the DB directly from `schema.prisma`.
```
