import type { AuthUser } from "@triageforge/contracts";
import {
  createContext,
  useContext
} from "react";

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
