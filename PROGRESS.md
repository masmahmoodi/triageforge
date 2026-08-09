# TriageForge Progress

## Completed
- Production GitHub App is configured at `https://github.com/apps/triageforge`.
- API is deployed on Render and connected to Neon PostgreSQL with pgvector.
- Web app is deployed on Vercel.
- Real GitHub issue webhooks are verified, stored, triaged with OpenAI, embedded, and shown in the dashboard.
- Human approval applies real GitHub labels and comments through the GitHub App.
- AI triage loading states and polling are in place for slower OpenAI responses.
- Login, register, and logout are mounted before CSRF protection so stale CSRF cookies cannot trap users in a broken session.
- Logout now clears all frontend query cache immediately so stale account data is not reused after switching users.
- GitHub App installations are guarded so one installation cannot be silently reused by a different TriageForge account.

## Remaining Improvements
- Add a polished public landing/demo page for recruiters.
- Add repository/team management views beyond the current issue dashboard.
- Add monitoring/alerting for production failures and OpenAI latency.
- Add richer end-to-end tests against deployed staging services.

## Known Limitations
- Render free instances can sleep, so first API requests may be slow.
- AI triage latency depends on OpenAI response time.
- Users currently install one GitHub App owned by the project maintainer.
- A GitHub App installation belongs to one TriageForge account; to move it to another account, uninstall and reinstall the app.

## External Setup Required
- Keep `.env`, GitHub private keys, webhook secrets, OpenAI API keys, and database URLs out of Git.
- Production environment variables must be configured only inside Render and Vercel dashboards.
