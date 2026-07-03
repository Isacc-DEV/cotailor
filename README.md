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
- pnpm 11.9.0+
- PostgreSQL 16

### Installation

```bash
git clone https://github.com/c-vando/cotailor.git
cd cotailor
pnpm install
pnpm run prisma:generate
pnpm dev
```

**URLs:**
- Web: http://localhost:3000
- API: http://localhost:3001

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
