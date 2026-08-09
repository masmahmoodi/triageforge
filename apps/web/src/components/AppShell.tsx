import { GitBranch, LogOut, ShieldCheck } from "lucide-react";
import { Link, Outlet, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { logout, setCsrfToken } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { Button } from "./Button";

export function AppShell(): React.ReactElement {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onMutate: async () => {
      await queryClient.cancelQueries();
      setCsrfToken(null);
      queryClient.removeQueries();
      queryClient.setQueryData(["auth", "me"], null);
      void navigate("/login", { replace: true });
    },
    onSettled: () => {
      setCsrfToken(null);
      queryClient.removeQueries();
      queryClient.setQueryData(["auth", "me"], null);
    }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading TriageForge
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
            <span className="text-base font-semibold">TriageForge</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden max-w-[260px] truncate text-sm text-slate-600 sm:inline">
              {user.email}
            </span>
            <Button
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-7xl items-center gap-2 px-4 pb-6 text-xs text-slate-500 sm:px-6 lg:px-8">
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        Real GitHub App actions run only after approval.
      </footer>
    </div>
  );
}
