# Demo Instructions

## 1. Start PostgreSQL

```bash
docker compose up -d postgres
pnpm db:migrate
```

## 2. Configure Secrets

Copy `.env.example` to `.env` and fill these values:

- `GITHUB_APP_ID`: from GitHub App settings.
- `GITHUB_APP_SLUG`: the app slug in its public URL.
- `GITHUB_PRIVATE_KEY_BASE64`: base64 of the downloaded GitHub App private key.
- `GITHUB_WEBHOOK_SECRET`: a random secret set in the GitHub App webhook settings.
- `OPENAI_API_KEY`: from the OpenAI platform.

These are secret except `GITHUB_APP_ID` and `GITHUB_APP_SLUG`. Do not commit `.env`, private keys, webhook secrets, database passwords, or API keys.

## 3. GitHub App Settings

Use these local callback and webhook URLs. For local development, tunnel the
restricted webhook proxy instead of the full API server:

- Callback URL: `http://127.0.0.1:4000/api/v1/github/app/callback`
- Webhook URL: `https://YOUR-TUNNEL/api/v1/github/webhooks`
- Setup URL: `http://127.0.0.1:4000/api/v1/github/app/callback`

Enable "Redirect on update" so reconnecting an existing installation returns to
TriageForge with a setup `state`.

Minimum permissions:

- Metadata: read
- Issues: read and write

Subscribe to:

- Issues

## 4. Run The App

Terminal 1:

```bash
pnpm api:dev
```

Terminal 2:

```bash
pnpm web:dev
```

Terminal 3:

```bash
pnpm webhook:proxy
```

Terminal 4, using Cloudflare Tunnel through Docker:

```bash
docker run --rm -it cloudflare/cloudflared:latest tunnel --protocol http2 --url http://host.docker.internal:4010
```

Use the printed `https://...trycloudflare.com` URL as `https://YOUR-TUNNEL` in
the GitHub App webhook URL. Keep all terminals open while testing.

Open `http://127.0.0.1:5173`, register, connect a repository, then create or edit a GitHub issue in that repository.

## 5. Review And Apply

Open the issue in TriageForge, review suggested labels, similar issues, priority, and draft response. Select the final labels/comment and click Apply to GitHub.
