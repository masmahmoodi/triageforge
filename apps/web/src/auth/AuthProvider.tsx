import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse } from "@triageforge/contracts";
import {
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren
} from "react";

import { ApiClientError, getMe, setCsrfToken } from "../api/client";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren): React.ReactElement {
  const queryClient = useQueryClient();
  const [sessionOverride, setSessionOverride] = useState<
    AuthResponse["data"] | null | undefined
  >(undefined);
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: (failureCount, error) =>
      !(error instanceof ApiClientError && error.status === 401) &&
      failureCount < 1
  });
  const auth = sessionOverride === undefined
    ? meQuery.data?.data ?? null
    : sessionOverride;

  const establishSession = useCallback((response: AuthResponse) => {
    setSessionOverride(response.data);
    setCsrfToken(response.data.csrfToken);
    queryClient.setQueryData(["auth", "me"], response);
  }, [queryClient]);

  const clearSession = useCallback(() => {
    setSessionOverride(null);
    setCsrfToken(null);
    queryClient.setQueryData(["auth", "me"], null);
  }, [queryClient]);

  useEffect(() => {
    setCsrfToken(auth?.csrfToken ?? null);
  }, [auth?.csrfToken]);

  useEffect(() => {
    if (meQuery.error instanceof ApiClientError && meQuery.error.status === 401) {
      clearSession();
    }
  }, [clearSession, meQuery.error]);

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user ?? null,
        isLoading: sessionOverride === undefined && meQuery.isLoading,
        establishSession,
        clearSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
