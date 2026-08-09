import { GitBranch, LogOut, ShieldCheck } from "lucide-react";
import { Link, Outlet, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { logout } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { Button } from "./Button";

export function AppShell(): React.ReactElement {
  const { user, isLoading, clearSession } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const finishLogout = (): void => {
    void queryClient.cancelQueries();
    clearSession();
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "auth"
    });
    void navigate("/login", { replace: true });
  };
  const logoutMutation = useMutation({
    mutationFn: logout,
    onMutate: finishLogout,
    onError: finishLogout
  });

  if (isLoading) {
    return (
      <div className="auth-bg soft-grid flex min-h-screen items-center justify-center px-4 text-sm text-slate-600">
        <div className="surface rounded-lg px-5 py-4">
          Loading TriageForge
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-bg min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 ring-1 ring-teal-100">
              <ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-normal">TriageForge</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden max-w-[260px] truncate rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 sm:inline">
              {user.email}
            </span>
            <Button
              aria-label="Log out"
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              title="Log out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-7xl items-center gap-2 px-4 pb-8 text-xs text-slate-500 sm:px-6 lg:px-8">
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        Real GitHub App actions run only after approval.
      </footer>
    </div>
  );
}
