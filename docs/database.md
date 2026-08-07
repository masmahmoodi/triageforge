# Database

The database is PostgreSQL with `pgcrypto` and `vector` extensions.

## Core Tables

- `users`: local account identity and scrypt password hashes.
- `sessions`: opaque cookie session hashes, CSRF tokens, expiry, revocation.
- `github_app_states`: short-lived GitHub App install state tokens.
- `github_installations`: GitHub App installations linked to users after callback.
- `repositories`: real GitHub repositories available through installations.
- `issues`: real GitHub issue state, labels in JSONB, label name arrays, full-text search vector.
- `webhook_deliveries`: idempotency ledger keyed by `X-GitHub-Delivery`.
- `triage_analyses`: AI structured analysis JSONB, priority, suggested labels, pgvector embedding.
- `similar_issue_candidates`: materialized similar issue suggestions per analysis.
- `issue_approvals`: human approvals and GitHub apply results.
- `repository_labels`: known labels and colors per repository.

## Indexes And Constraints

- Unique user email uses a generated lowercase column.
- Issues are unique by `(repository_id, number)` and `(repository_id, github_id)`.
- Issue dashboard pagination uses `(github_updated_at DESC, id DESC)`.
- Full-text search uses a generated `tsvector` GIN index.
- Labels use JSONB and text-array GIN indexes.
- Completed triage priority has a partial index.
- Embeddings use an HNSW pgvector cosine index with `vector_cosine_ops`.

## Migrations

Run:

```bash
pnpm db:migrate
```

The migration runner:

- reads `apps/api/db/migrations/*.sql`,
- takes a transaction-scoped advisory lock,
- records applied versions in `schema_migrations`,
- runs each migration inside one transaction.

The default local URL is:

```text
postgres://triageforge:triageforge@127.0.0.1:54329/triageforge
```

Start local Postgres with:

```bash
docker compose up -d postgres
```
