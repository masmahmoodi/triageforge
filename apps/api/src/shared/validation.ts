import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

import { badRequest } from "./errors.js";

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(badRequest("Request body failed validation", result.error.flatten()));
      return;
    }

    request.body = result.data;
    next();
  };
}

export function parseQuery<T>(schema: ZodSchema<T>, query: unknown): T {
  const result = schema.safeParse(query);

  if (!result.success) {
    throw badRequest("Query string failed validation", result.error.flatten());
  }

  return result.data;
}
