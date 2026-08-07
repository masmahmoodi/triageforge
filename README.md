# TriageForge

TriageForge is an AI-powered GitHub Issue Intelligence Platform. It connects to real repositories through a GitHub App, verifies issue webhooks, stores issues in PostgreSQL, generates structured AI triage, finds similar issues with pgvector, and applies labels/comments only after human approval.

## Stack

- Frontend: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS
- Backend: Node.js, Express, TypeScript, raw `pg`, Zod, Pino, Helmet, express-rate-limit
- Database: PostgreSQL, pgvector, JSONB, full-text search, cursor pagination, composite/partial indexes

## Quick Start

```bash
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm api:dev
pnpm web:dev
```

Open `http://127.0.0.1:5173`.

## Architecture Highlights

- Real GitHub App installation, installation tokens, issue webhooks, labels, and comments.
- Raw-body `X-Hub-Signature-256` webhook verification.
- Idempotent delivery ledger keyed by `X-GitHub-Delivery`.
- PostgreSQL schema with JSONB, full-text search, cursor pagination, pgvector, composite indexes, and partial indexes.
- OpenAI structured issue triage validated with Zod before persistence.
- Human-in-the-loop approval before any GitHub write.
- Restricted local webhook proxy for safer tunnel demos.

## Configuration

Copy `.env.example` to `.env` and fill in real credentials.

Required for full functionality:

- `DATABASE_URL`
- `GITHUB_APP_ID`
- `GITHUB_APP_SLUG`
- `GITHUB_PRIVATE_KEY_BASE64` or `GITHUB_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

Never commit `.env`, private keys, webhook secrets, API keys, database passwords, or downloaded GitHub private key files.

## Scripts

- `pnpm api:dev`: run the API
- `pnpm web:dev`: run the React app
- `pnpm webhook:proxy`: expose only webhook and health routes to a local tunnel
- `pnpm db:migrate`: apply SQL migrations
- `pnpm test`: run unit/API/component tests
- `pnpm e2e`: run Playwright smoke tests when `E2E_BASE_URL` is set
- `pnpm lint`: run ESLint
- `pnpm typecheck`: run TypeScript checks
- `pnpm build`: build contracts, API, and web app

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Demo Instructions](docs/demo.md)
- [Deployment Guide](docs/deployment.md)
