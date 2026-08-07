export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown;

  public constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, "bad_request", message, details);
}

export function unauthorized(message = "Authentication is required"): HttpError {
  return new HttpError(401, "unauthorized", message);
}

export function forbidden(message = "You do not have access to this resource"): HttpError {
  return new HttpError(403, "forbidden", message);
}

export function notFound(message = "Resource not found"): HttpError {
  return new HttpError(404, "not_found", message);
}

export function conflict(message: string, details?: unknown): HttpError {
  return new HttpError(409, "conflict", message, details);
}

export function integrationUnavailable(message: string): HttpError {
  return new HttpError(503, "integration_unavailable", message);
}
