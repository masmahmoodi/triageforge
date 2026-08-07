import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { config as loadDotenv } from "dotenv";

import { z } from "zod";

loadNearestDotenv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  WEB_ORIGIN: z.string().url().default("http://127.0.0.1:5173"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://triageforge:triageforge@127.0.0.1:54329/triageforge"),
  SESSION_COOKIE_NAME: z.string().min(1).default("triageforge_session"),
  SESSION_COOKIE_DOMAIN: optionalNonEmptyString(),
  SESSION_COOKIE_SAMESITE: z
    .enum(["lax", "strict", "none"])
    .default("lax"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(60).default(14),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  GITHUB_API_BASE_URL: z
    .string()
    .url()
    .default("https://api.github.com"),
  GITHUB_APP_ID: optionalNonEmptyString(),
  GITHUB_APP_SLUG: optionalNonEmptyString(),
  GITHUB_PRIVATE_KEY: optionalNonEmptyString(),
  GITHUB_PRIVATE_KEY_BASE64: optionalNonEmptyString(),
  GITHUB_WEBHOOK_SECRET: optionalNonEmptyString(),
  OPENAI_API_KEY: optionalNonEmptyString(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_TRIAGE_MODEL: z.string().min(1).default("gpt-5-mini"),
  OPENAI_EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default("text-embedding-3-small"),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536)
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);
  const githubPrivateKey =
    parsed.GITHUB_PRIVATE_KEY ??
    decodeOptionalBase64(parsed.GITHUB_PRIVATE_KEY_BASE64);

  return {
    nodeEnv: parsed.NODE_ENV,
    apiHost: parsed.API_HOST,
    apiPort: parsed.API_PORT ?? parsed.PORT ?? 4000,
    webOrigin: parsed.WEB_ORIGIN,
    databaseUrl: parsed.DATABASE_URL,
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    sessionCookieDomain: parsed.SESSION_COOKIE_DOMAIN ?? null,
    sessionCookieSameSite: parsed.SESSION_COOKIE_SAMESITE,
    sessionTtlDays: parsed.SESSION_TTL_DAYS,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    github: {
      apiBaseUrl: parsed.GITHUB_API_BASE_URL,
      appId: parsed.GITHUB_APP_ID ?? null,
      appSlug: parsed.GITHUB_APP_SLUG ?? null,
      privateKey: githubPrivateKey ?? null,
      webhookSecret: parsed.GITHUB_WEBHOOK_SECRET ?? null
    },
    openai: {
      apiKey: parsed.OPENAI_API_KEY ?? null,
      baseUrl: parsed.OPENAI_BASE_URL,
      triageModel: parsed.OPENAI_TRIAGE_MODEL,
      embeddingModel: parsed.OPENAI_EMBEDDING_MODEL,
      embeddingDimensions: parsed.OPENAI_EMBEDDING_DIMENSIONS
    }
  };
}

function decodeOptionalBase64(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return Buffer.from(value, "base64").toString("utf8");
}

function optionalNonEmptyString() {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional()
  );
}

function loadNearestDotenv(): void {
  let directory = process.cwd();

  while (true) {
    const envPath = join(directory, ".env");

    if (existsSync(envPath)) {
      loadDotenv({
        path: envPath,
        override: false
      });
      return;
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return;
    }

    directory = parent;
  }
}
