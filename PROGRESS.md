# TriageForge Progress

## Completed
- Production GitHub App is configured at `https://github.com/apps/triageforge`.
- API is deployed on Render and connected to Neon PostgreSQL with pgvector.
- Web app is deployed on Vercel.
- Real GitHub issue webhooks are verified, stored, triaged with OpenAI, embedded, and shown in the dashboard.
- Human approval applies real GitHub labels and comments through the GitHub App.
- AI triage loading states and polling are in place for slower OpenAI responses.
- Logout now clears the frontend auth state immediately and the API accepts logout even when the CSRF token is stale.

## Remaining Improvements
- Add a polished public landing/demo page for recruiters.
- Add repository/team management views beyond the current issue dashboard.
- Add monitoring/alerting for production failures and OpenAI latency.
- Add richer end-to-end tests against deployed staging services.

## Known Limitations
- Render free instances can sleep, so first API requests may be slow.
- AI triage latency depends on OpenAI response time.
- Users currently install one GitHub App owned by the project maintainer.

## External Setup Required
- Keep `.env`, GitHub private keys, webhook secrets, OpenAI API keys, and database URLs out of Git.
- Production environment variables must be configured only inside Render and Vercel dashboards.
