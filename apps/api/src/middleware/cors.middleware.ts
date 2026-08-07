import type { RequestHandler } from "express";

import type { AppConfig } from "../config/env.js";

export function corsMiddleware(config: AppConfig): RequestHandler {
  return (request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", config.webOrigin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token, X-Request-Id"
    );
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );

    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    next();
  };
}
