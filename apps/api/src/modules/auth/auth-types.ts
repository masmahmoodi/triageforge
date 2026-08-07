import type { AuthUser } from "@triageforge/contracts";

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
}

export interface AuthContext {
  user: AuthUser;
  session: SessionRecord;
}
