import type { Request } from "express";

import { badRequest } from "./errors.js";

export function requiredParam(request: Request, name: string): string {
  const value = request.params[name];
  const normalized = Array.isArray(value) ? value[0] : value;

  if (!normalized) {
    throw badRequest(`Missing route parameter: ${name}`);
  }

  return normalized;
}
