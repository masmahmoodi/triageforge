# Architecture

TriageForge is a React and Express monorepo with shared Zod contracts. The backend uses raw `pg` queries against PostgreSQL and pgvector.

## Request Flow

1. A user registers or logs in.
2. The API creates an opaque session token, stores only its SHA-256 hash in PostgreSQL, and sets an HttpOnly SameSite cookie.
3. The user starts GitHub App installation from `/api/v1/github/app/setup-url`.
4. The callback verifies a one-time state token, fetches installation metadata with a GitHub App JWT, and syncs repositories using an installation token.
5. GitHub sends issue webhooks to `/api/v1/github/webhooks`.
6. The API verifies `X-Hub-Signature-256` against the raw request body.
7. `X-GitHub-Delivery` is inserted into `webhook_deliveries`; duplicate deliveries are accepted without reprocessing.
8. Issue and repository data are upserted in PostgreSQL.
9. OpenAI Responses API returns strict structured triage JSON, validated again with Zod.
10. OpenAI Embeddings API creates a 1536-dimensional embedding.
11. pgvector searches completed analyses in the same repository for similar issues.
12. A reviewer chooses labels/comment text in the UI.
13. The API creates any missing GitHub labels, adds labels to the issue, and posts the approved comment.

## Backend Modules

- `config`: dotenv and Zod environment parsing.
- `infrastructure/database`: `pg` pool, transactions, migration runner.
- `infrastructure/security`: password hashing, token hashing, session helpers.
- `modules/auth`: registration, login, logout, session middleware, CSRF checks.
- `modules/github`: GitHub App JWTs, installation tokens, repository sync, webhook verification.
- `modules/ai`: OpenAI structured triage and embeddings.
- `modules/issues`: issue queries, cursor pagination, triage persistence, approval workflow.

## Frontend

The React app uses React Router, TanStack Query, React Hook Form, Zod, and Tailwind CSS.

- `/login` and `/register` handle account access.
- `/` lists issues with repository, state, priority, and search filters.
- `/issues/:id` shows issue details, AI analysis, similar issues, labels, draft response, and approval history.
- `/github/callback` confirms GitHub installation sync.

## Security Notes

- Webhook signatures are verified from the raw body before JSON parsing.
- Sessions are opaque and database-backed; only token hashes are stored.
- Authenticated unsafe methods require `X-CSRF-Token`.
- GitHub private keys, webhook secrets, OpenAI keys, and database credentials must stay out of Git.
