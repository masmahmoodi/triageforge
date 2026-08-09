import express from "express";
import request from "supertest";
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import { errorMiddleware } from "../src/middleware/error.middleware.js";
import type { AuthService } from "../src/modules/auth/auth-service.js";
import { createAuthRouter } from "../src/modules/auth/auth-routes.js";

describe("POST /api/v1/auth/logout", () => {
  it("is idempotent and clears the cookie without an active session", async () => {
    const resolveSession = vi.fn().mockResolvedValue(null);
    const revokeSession = vi.fn();
    const clearSessionCookie = vi.fn((response) => {
      response.clearCookie("triageforge_session");
    });
    const authService = {
      clearSessionCookie,
      resolveSession,
      revokeSession
    } as unknown as AuthService;
    const app = express();

    app.use(express.json());
    app.use("/api/v1/auth", createAuthRouter(authService));
    app.use(errorMiddleware);

    const response = await request(app)
      .post("/api/v1/auth/logout")
      .expect(204);

    expect(resolveSession).toHaveBeenCalledOnce();
    expect(revokeSession).not.toHaveBeenCalled();
    expect(clearSessionCookie).toHaveBeenCalledOnce();
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "triageforge_session="
    );
  });
});
