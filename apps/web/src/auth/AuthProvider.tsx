import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  type PropsWithChildren
} from "react";

import { ApiClientError, getMe, setCsrfToken } from "../api/client";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren): React.ReactElement {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: (failureCount, error) =>
      !(error instanceof ApiClientError && error.status === 401) &&
      failureCount < 1
  });
  const auth = meQuery.data?.data ?? null;

  useEffect(() => {
    setCsrfToken(auth?.csrfToken ?? null);
  }, [auth?.csrfToken]);

  useEffect(() => {
    if (meQuery.error instanceof ApiClientError && meQuery.error.status === 401) {
      setCsrfToken(null);
      queryClient.setQueryData(["auth", "me"], null);
    }
  }, [meQuery.error, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user ?? null,
        isLoading: meQuery.isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
