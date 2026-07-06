# 🎯 CoTailor: Collaborative AI Resume Tailoring

> **The intelligent resume tailor that checks job fit before it writes a word** — and never puts anything on your resume that isn't true.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)

## 🚀 Overview

CoTailor is a full-stack monorepo application that helps you tailor your resume honestly. Instead of guessing what to emphasize, the app analyzes the job description, validates your fit against category and subtype gates, and only then generates a tailored resume backed by real decisions you make.

### ✨ Key Features

- ✅ **Smart Category & Subtype Gates** – Category and subtype matching before any resume generation
- ✅ **Decision Board** – Structured, focused decisions on skill matching and strategy
- ✅ **Provenance-Backed** – Every resume bullet is traceable to a verified fact or user decision
- ✅ **Rich Profile System** – Save multiple professional profiles with 6 structured sections
- ✅ **JSON-First Data** – Work experience, education, certifications in flexible JSON
- ✅ **Resume Styles** – Standard, modern, minimal, or creative formatting
- ✅ **Export Options** – Download as DOCX, PDF, or JSON

## 📁 Project Structure

```
cotailor/
├── apps/
│   ├── api/              # NestJS 10 backend + Prisma ORM
│   └── web/              # Next.js 15 frontend
├── packages/
│   └── shared/           # Enums, schemas, gates
└── pnpm-workspace.yaml   # Monorepo config
```

## 🏗️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js, React, TypeScript | 15, 19, 5.7 |
| Backend | NestJS, Prisma, PostgreSQL | 10, 5, 16 |
| Shared | TypeScript, Zod | 5.7, 3.25 |
| Database | PostgreSQL | 16 |
| LLM | Claude API (pluggable) | Latest |

## 📋 Profile Structure (6 Sections)

1. **Basic Information** – Profile name, job category, job subtype, resume style
2. **Header** – Name, title, address, phone, LinkedIn, website/portfolio
3. **Work Experience** – Companies (JSON), title, dates, description
4. **Education** – Universities (JSON), degree, field, graduation year
5. **Skills** – Comma-separated technical skills
6. **Certifications** – Certifications (JSON), issuer, year

## 🎯 Core Gates

- **Category Gate** – Profile category must match JD category
- **Subtype Gate** – Profile subtype vs JD subtype (soft gate; override allowed)

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+ (`corepack enable` gives you the pinned version automatically)
- Docker Desktop (for PostgreSQL 16 — or bring your own Postgres, see below)

### Installation

```bash
git clone https://github.com/c-vando/cotailor.git
cd cotailor

# 1. Install dependencies
pnpm install

# 2. Create the API env file (defaults work as-is with the Docker database)
cp apps/api/.env.example apps/api/.env

# 3. Start Postgres, generate the Prisma client, apply the schema — one command
pnpm run setup

# 4. Run everything (web + api in watch mode)
pnpm dev
```

**URLs:**
- Web: http://localhost:3000
- API: http://localhost:3001 (health check: `curl http://localhost:3001/health`)

There's no seed data — sign up in the web UI, create a profile, and start a session.
The default `LLM_PROVIDER="stub"` needs **no API key** (instant mock responses); switch
to `gemini` or `openai` in `apps/api/.env` when you want real analysis, and restart
`pnpm dev` afterwards (env is only read at startup).

### Using your own Postgres (no Docker)

Point `DATABASE_URL` in `apps/api/.env` at your server, then instead of `pnpm run setup`:

```bash
pnpm run prisma:generate
pnpm run db:push        # applies prisma/schema.prisma directly (no migrations needed)
```

### Schema notes (read before touching the DB)

- **`prisma db push` is the source of truth path** — it syncs the database to
  `apps/api/prisma/schema.prisma`. There is no `migrations/` history in this repo.
- `apps/api/prisma/init.sql` is a **fallback** for machines where Prisma's native
  schema engine crashes (SIGILL on some CPUs). It must be kept manually in sync with
  `schema.prisma` — drift between them causes runtime errors like
  `Null constraint violation on the (not available)`. Apply it without a local psql via:
  ```bash
  # PowerShell
  Get-Content apps/api/prisma/init.sql -Raw | docker exec -i cotailor-postgres psql -U cotailor -d cotailor
  # bash
  docker exec -i cotailor-postgres psql -U cotailor -d cotailor < apps/api/prisma/init.sql
  ```
  ⚠️ `init.sql` drops and recreates the whole schema — it wipes all data.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Environment variable not found: DATABASE_URL` | You skipped step 2 — create `apps/api/.env` from the example. |
| API starts but every request fails / frontend stuck loading | Postgres isn't running (`pnpm run db:up`) or the schema was never applied (`pnpm run db:push`). |
| Changed `.env` but nothing happened | Restart `pnpm dev` — env is read once at startup. |
| `Null constraint violation on the (not available)` | Your DB drifted from `schema.prisma` (usually an old `init.sql` init). Run `pnpm run db:push`. |
| Prisma CLI crashes with SIGILL | Your CPU can't run the native engine — use the `init.sql` fallback above. The app itself is unaffected (it uses the pure-JS pg driver). |

## 🔐 Security

- ✅ No Fabrication – Gate logic prevents inflating claims
- ✅ Provenance Tracking – Every bullet tagged with source
- ✅ User Control – All decisions made by you
- ✅ Privacy-First – Everything stays on your account

## 📄 License

MIT License

## 👋 Contact

- **Author:** c-vando-source
- **Email:** c-vando@aira-technology.com

---

**Made with ❤️ to help you tailor resumes honestly.**
