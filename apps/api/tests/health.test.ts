import request from "supertest";
import {
  describe,
  expect,
  it
} from "vitest";

import { createApp } from "../src/app.js";

describe("GET /api/v1/health", () => {
  it("returns a healthy API response with a request ID", async () => {
    const app = createApp();

    const response = await request(app)
      .get("/api/v1/health")
      .expect(200);

    expect(response.body).toEqual({
      data: {
        status: "ok"
      },
      meta: {
        requestId: expect.any(String)
      }
    });

    expect(response.headers["x-request-id"]).toBe(
      response.body.meta.requestId
    );

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(
      response.headers["content-security-policy"]
    ).toBeDefined();
  });

  it("preserves a valid client request ID", async () => {
    const app = createApp();
    const requestId = "test-request-123";

    const response = await request(app)
      .get("/api/v1/health")
      .set("X-Request-Id", requestId)
      .expect(200);

    expect(response.body.meta.requestId).toBe(requestId);
    expect(response.headers["x-request-id"]).toBe(requestId);
  });

  it("replaces an unsafe client request ID", async () => {
    const app = createApp();

    const response = await request(app)
      .get("/api/v1/health")
      .set("X-Request-Id", "unsafe request id")
      .expect(200);

    expect(response.body.meta.requestId).not.toBe(
      "unsafe request id"
    );

    expect(response.body.meta.requestId).toEqual(
      expect.any(String)
    );
  });
});