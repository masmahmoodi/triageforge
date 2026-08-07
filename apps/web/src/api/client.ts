import type {
  AuthResponse,
  IssueDetail,
  IssueListResponse,
  Repository
} from "@triageforge/contracts";

let csrfToken: string | null = null;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
  : "";

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;

  public constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(input.message);
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (
    csrfToken &&
    method !== "GET" &&
    method !== "HEAD" &&
    shouldAttachCsrfToken(path)
  ) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const requestInit: RequestInit = {
    method,
    headers,
    credentials: "include"
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, requestInit);

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorPayload = payload as {
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
      };
    };

    throw new ApiClientError({
      status: response.status,
      code: errorPayload.error?.code ?? "request_failed",
      message: errorPayload.error?.message ?? "Request failed",
      details: errorPayload.error?.details
    });
  }

  return payload as T;
}

export function getMe(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/me");
}

export function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  setCsrfToken(null);

  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: input
  });
}

export function register(input: {
  email: string;
  name?: string | undefined;
  password: string;
}): Promise<AuthResponse> {
  setCsrfToken(null);

  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: input
  });
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("/auth/logout", {
      method: "POST"
    });
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      (error.status === 401 || error.status === 403)
    ) {
      return;
    }

    throw error;
  }
}

export function listRepositories(): Promise<{ data: Repository[] }> {
  return apiRequest<{ data: Repository[] }>("/repositories");
}

export function listIssues(query: URLSearchParams): Promise<IssueListResponse> {
  return apiRequest<IssueListResponse>(`/issues?${query.toString()}`);
}

export function getIssue(issueId: string): Promise<{ data: IssueDetail }> {
  return apiRequest<{ data: IssueDetail }>(`/issues/${issueId}`);
}

export function getGitHubSetupUrl(): Promise<{ data: { url: string } }> {
  return apiRequest<{ data: { url: string } }>("/github/app/setup-url");
}

export function retriageIssue(issueId: string): Promise<void> {
  return apiRequest<void>(`/issues/${issueId}/triage`, {
    method: "POST"
  });
}

export function approveIssue(input: {
  issueId: string;
  analysisId: string;
  labels: string[];
  comment?: string | undefined;
}): Promise<void> {
  return apiRequest<void>(`/issues/${input.issueId}/approvals`, {
    method: "POST",
    body: {
      analysisId: input.analysisId,
      labels: input.labels,
      ...(input.comment?.trim() ? { comment: input.comment } : {})
    }
  });
}

function shouldAttachCsrfToken(path: string): boolean {
  return !["/auth/login", "/auth/logout", "/auth/register"].includes(path);
}
