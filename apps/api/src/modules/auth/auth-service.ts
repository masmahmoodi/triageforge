import type { AuthUser } from "@triageforge/contracts";
import type { Response } from "express";
import { parseCookie, stringifySetCookie } from "cookie";

import type { AppConfig } from "../../config/env.js";
import type { Database, Queryable } from "../../infrastructure/database/database.js";
import { sha256, randomToken, constantTimeEqual } from "../../infrastructure/security/hash.js";
import { hashPassword, verifyPassword } from "../../infrastructure/security/password.js";
import { conflict, unauthorized } from "../../shared/errors.js";
import type { AuthContext, SessionRecord } from "./auth-types.js";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  created_at: Date;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  expires_at: Date;
  email: string;
  name: string | null;
  created_at: Date;
}

export class AuthService {
  public constructor(
    private readonly database: Database,
    private readonly config: AppConfig
  ) {}

  public async register(input: {
    email: string;
    name?: string | undefined;
    password: string;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
  }): Promise<{ auth: AuthContext; cookieValue: string }> {
    const passwordHash = await hashPassword(input.password);

    return this.database.transaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE email_normalized = lower($1)",
        [input.email]
      );

      if ((existing.rowCount ?? 0) > 0) {
        throw conflict("An account with this email already exists");
      }

      const userResult = await client.query<UserRow>(
        `
          INSERT INTO users (email, name, password_hash)
          VALUES ($1, $2, $3)
          RETURNING id, email, name, password_hash, created_at
        `,
        [input.email.toLowerCase(), input.name ?? null, passwordHash]
      );
      const user = mapUser(userResult.rows[0]);
      const session = await this.createSession(client, user.id, input);

      return {
        auth: {
          user,
          session: session.record
        },
        cookieValue: session.cookieValue
      };
    });
  }

  public async login(input: {
    email: string;
    password: string;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
  }): Promise<{ auth: AuthContext; cookieValue: string }> {
    const userResult = await this.database.query<UserRow>(
      `
        SELECT id, email, name, password_hash, created_at
        FROM users
        WHERE email_normalized = lower($1)
      `,
      [input.email]
    );
    const userRow = userResult.rows[0];

    if (!userRow || !(await verifyPassword(input.password, userRow.password_hash))) {
      throw unauthorized("Invalid email or password");
    }

    const user = mapUser(userRow);
    const session = await this.database.transaction((client) =>
      this.createSession(client, user.id, input)
    );

    return {
      auth: {
        user,
        session: session.record
      },
      cookieValue: session.cookieValue
    };
  }

  public async resolveSession(cookieHeader: string | undefined): Promise<AuthContext | null> {
    const cookieValue = cookieHeader
      ? parseCookie(cookieHeader)[this.config.sessionCookieName]
      : undefined;

    if (!cookieValue) {
      return null;
    }

    const [sessionId, secret] = cookieValue.split(".");

    if (!sessionId || !secret) {
      return null;
    }

    const result = await this.database.query<SessionRow>(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
          s.token_hash,
          s.csrf_token,
          s.expires_at,
          u.email,
          u.name,
          u.created_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
      `,
      [sessionId]
    );
    const row = result.rows[0];

    if (!row || !constantTimeEqual(row.token_hash, sha256(secret))) {
      return null;
    }

    return {
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        createdAt: row.created_at.toISOString()
      },
      session: {
        id: row.session_id,
        userId: row.user_id,
        tokenHash: row.token_hash,
        csrfToken: row.csrf_token,
        expiresAt: row.expires_at
      }
    };
  }

  public async revokeSession(sessionId: string): Promise<void> {
    await this.database.query(
      `
        UPDATE sessions
        SET revoked_at = now()
        WHERE id = $1
      `,
      [sessionId]
    );
  }

  public setSessionCookie(
    response: Response,
    cookieValue: string,
    expiresAt: Date
  ): void {
    response.setHeader(
      "Set-Cookie",
      stringifySetCookie({
        name: this.config.sessionCookieName,
        value: cookieValue,
        httpOnly: true,
        secure: this.config.nodeEnv === "production",
        sameSite: this.config.sessionCookieSameSite,
        ...(this.config.sessionCookieDomain
          ? { domain: this.config.sessionCookieDomain }
          : {}),
        path: "/",
        expires: expiresAt,
        maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      })
    );
  }

  public clearSessionCookie(response: Response): void {
    response.setHeader(
      "Set-Cookie",
      stringifySetCookie({
        name: this.config.sessionCookieName,
        value: "",
        httpOnly: true,
        secure: this.config.nodeEnv === "production",
        sameSite: this.config.sessionCookieSameSite,
        ...(this.config.sessionCookieDomain
          ? { domain: this.config.sessionCookieDomain }
          : {}),
        path: "/",
        expires: new Date(0),
        maxAge: 0
      })
    );
  }

  private async createSession(
    client: Queryable,
    userId: string,
    input: {
      userAgent?: string | undefined;
      ipAddress?: string | undefined;
    }
  ): Promise<{ record: SessionRecord; cookieValue: string }> {
    const secret = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(
      Date.now() + this.config.sessionTtlDays * 24 * 60 * 60 * 1000
    );
    const result = await client.query<{
      id: string;
      token_hash: string;
      csrf_token: string;
      expires_at: Date;
    }>(
      `
        INSERT INTO sessions (
          user_id,
          token_hash,
          csrf_token,
          user_agent,
          ip_address,
          expires_at
        )
        VALUES ($1, $2, $3, $4, NULLIF($5, '')::inet, $6)
        RETURNING id, token_hash, csrf_token, expires_at
      `,
      [
        userId,
        sha256(secret),
        csrfToken,
        input.userAgent ?? null,
        input.ipAddress ?? "",
        expiresAt
      ]
    );
    const row = requireRow(result.rows[0]);

    return {
      record: {
        id: row.id,
        userId,
        tokenHash: row.token_hash,
        csrfToken: row.csrf_token,
        expiresAt: row.expires_at
      },
      cookieValue: `${row.id}.${secret}`
    };
  }
}

function requireRow<T>(row: T | undefined): T {
  if (!row) {
    throw new Error("Expected database row");
  }

  return row;
}

function mapUser(row: UserRow | undefined): AuthUser {
  if (!row) {
    throw new Error("Expected user row");
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at.toISOString()
  };
}
