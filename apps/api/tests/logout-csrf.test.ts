import type {
  NextFunction,
  Request,
  Response
} from "express";
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import { csrfMiddleware } from "../src/modules/auth/auth-middleware.js";

describe("csrfMiddleware auth session handling", () => {
  it.each([
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/api/v1/auth/register"
  ])("allows %s without a CSRF token", (path) => {
    const request = {
      auth: {
        session: {
          csrfToken: "known-token"
        }
      },
      header: vi.fn(() => undefined),
      method: "POST",
      path
    } as unknown as Request;
    const response = {} as Response;
    const next = vi.fn() as NextFunction;

    csrfMiddleware(request, response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("still rejects other unsafe requests without a CSRF token", () => {
    const request = {
      auth: {
        session: {
          csrfToken: "known-token"
        }
      },
      header: vi.fn(() => undefined),
      method: "POST",
      path: "/api/v1/issues/issue-id/approvals"
    } as unknown as Request;
    const response = {} as Response;
    const next = vi.fn() as NextFunction;

    csrfMiddleware(request, response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403
      })
    );
  });
});
