-- Seed the bootstrap admin account. Idempotent (ON CONFLICT on the unique email).
--   Name:     Isacc
--   Email:    wrenikey.dev@gmail.com
--   Password: Welcome2024!   (bcrypt, 10 rounds — matches AuthService BCRYPT_ROUNDS)
--   Role:     admin           Status: active (ready to sign in immediately)
--
-- Run AFTER the schema exists (init.sql). Manually:
--   psql "$DATABASE_URL" -f apps/api/prisma/seed-admin.sql
-- In Docker it runs automatically from /docker-entrypoint-initdb.d on first init.
--
-- Change this password after the first sign-in (Settings → password).

INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "status", "verifiedAt", "createdAt")
VALUES (
  'usr_seed_admin_isacc',
  'wrenikey.dev@gmail.com',
  'Isacc',
  '$2b$10$yvezaiaAJbIZO05YKpJEbuBTpMc5VMvgpAVYAeHdZ484lG1kTzh2G',
  'admin',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
  "name"         = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "role"         = 'admin',
  "status"       = 'active',
  "verifiedAt"   = COALESCE("User"."verifiedAt", CURRENT_TIMESTAMP),
  "disabledAt"   = NULL;
