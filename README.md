# TriageForge

TriageForge is an AI-powered GitHub Issue Intelligence Platform. It connects to real repositories through a GitHub App, verifies issue webhooks, stores issues in PostgreSQL, generates structured AI triage, finds similar issues with pgvector, and applies labels/comments only after human approval.

[Live application](https://triageforge-web.vercel.app) | [Demo Video](https://youtu.be/6pzyX2iikdo) | [Install the GitHub App](https://github.com/apps/triageforge) | [API health](https://triageforge-api.onrender.com/api/v1/health)

> The hosted API uses a free Render instance and may need about a minute to wake up after inactivity.

## The Problem

Issue maintainers repeatedly read incomplete reports, assign priorities and labels, search for duplicates, and draft responses. TriageForge prepares that work while keeping a person in control of every GitHub write.

## How It Works

1. A user creates a TriageForge account and installs the public GitHub App on selected repositories.
2. GitHub sends signed issue events to the API.
3. The API verifies the raw-body signature and processes each delivery once.
4. PostgreSQL stores the repository and issue, then OpenAI produces schema-validated triage and an embedding.
5. pgvector finds semantically similar issues.
6. The user reviews the proposed priority, labels, duplicate candidates, missing information, and draft comment.
7. Only an explicit approval applies labels or posts a comment through the real GitHub API.

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

## Security Model

- Session identifiers are stored in secure, HTTP-only cookies; unsafe authenticated requests require a CSRF token.
- GitHub webhook signatures are verified with `X-Hub-Signature-256` before payload processing.
- `X-GitHub-Delivery` is persisted as an idempotency key so retries do not duplicate work.
- Repository, issue, installation, and approval queries are scoped to the authenticated owner.
- A GitHub App installation can belong to only one TriageForge account. The API refuses silent reassignment to prevent another account from taking control of its repositories.

TriageForge accounts and GitHub accounts are separate identities. Creating another TriageForge login does not change the GitHub account currently signed into the browser. To test a different GitHub owner, sign out of GitHub or use a separate browser profile.

## Hosted Demo

1. Register at the [live application](https://triageforge-web.vercel.app).
2. Select **Connect repository** and install TriageForge on one test repository.
3. Open or edit a GitHub issue in that repository.
4. Wait for the AI analysis to complete, then open the issue in TriageForge.
5. Review the suggestions and select **Apply to GitHub**.
6. Confirm the approved labels and optional comment on the original GitHub issue.

Use a test repository for the demo because approvals perform real GitHub writes.

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

## Verification

The CI workflow starts PostgreSQL with pgvector and runs migrations, tests, linting, TypeScript checks, and production builds. The test suite covers authentication and logout behavior, CSRF enforcement, webhook signatures and actions, cursor encoding, migrations, password hashing, structured triage validation, and GitHub installation ownership.

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Demo Instructions](docs/demo.md)
- [Deployment Guide](docs/deployment.md)
