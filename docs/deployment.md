# Deployment Guide

This project can be hosted on free tiers for a portfolio demo:

- Database: Neon Free Postgres with `pgvector` enabled.
- API: Render Free Web Service.
- Web: Vercel Hobby or Render Static Site.

Free tiers are fine for recruiters and demos, not production SLAs. Expect cold
starts and usage limits.

## Database: Neon

1. Create a Neon project.
2. Enable the `vector` extension if it is not already available.
3. Copy the pooled or direct connection string.
4. Set `DATABASE_URL` in the API host.
5. Run migrations from your local machine or CI:

```bash
DATABASE_URL="postgres://..." pnpm db:migrate
```

## API: Render

Create a Render Web Service from this repository.
The repository includes `render.yaml` with the API service definition.

Recommended settings:

- Runtime: Node
- Build command: `pnpm install --frozen-lockfile && pnpm api:build`
- Start command: `pnpm db:migrate && pnpm --filter @triageforge/api start`
- Health check path: `/api/v1/health`

Environment variables:

- `NODE_ENV=production`
- `API_HOST=0.0.0.0`
- `API_PORT` should use Render's provided port if configured by the platform.
- `WEB_ORIGIN=https://your-web-domain`
- `DATABASE_URL`
- `SESSION_COOKIE_SAMESITE=none` when the frontend and API are on different domains.
- `GITHUB_APP_ID`
- `GITHUB_APP_SLUG`
- `GITHUB_PRIVATE_KEY_BASE64`
- `GITHUB_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

After the API URL is live, update the GitHub App:

- Callback URL: `https://your-api-domain/api/v1/github/app/callback`
- Setup URL: `https://your-api-domain/api/v1/github/app/callback`
- Webhook URL: `https://your-api-domain/api/v1/github/webhooks`

## Web: Vercel Or Render Static Site

The repository includes `vercel.json` for a Vercel static frontend deploy.

Build command:

```bash
pnpm web:build
```

Output directory:

```text
apps/web/dist
```

Environment variables:

- `VITE_API_BASE_URL=https://your-api-domain`

If the web and API are on separate domains, confirm the API has:

- `WEB_ORIGIN=https://your-web-domain`
- `SESSION_COOKIE_SAMESITE=none`

## Local Tunnel Demo

For local-only demos, do not expose the whole API. Run the restricted proxy:

```bash
pnpm webhook:proxy
```

Then tunnel only the proxy:

```bash
docker run --rm -it cloudflare/cloudflared:latest tunnel --protocol http2 --url http://host.docker.internal:4010
```

Use the printed `https://...trycloudflare.com` URL for the GitHub App webhook.
