import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";

import {
  loginRequestSchema,
  type AuthResponse
} from "@triageforge/contracts";
import { login } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { Button } from "../components/Button";

type LoginValues = Parameters<typeof login>[0];

export function LoginPage(): React.ReactElement {
  const { user, isLoading, establishSession } = useAuth();
  const navigate = useNavigate();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (response: AuthResponse) => {
      establishSession(response);
      void navigate("/", { replace: true });
    }
  });

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthFrame title="Log in">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          void form.handleSubmit((values) => mutation.mutate(values))(event);
        }}
      >
        <Field
          label="Email"
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Field
          label="Password"
          type="password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        {mutation.error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {mutation.error.message}
          </p>
        ) : null}
        <Button className="w-full" disabled={mutation.isPending} type="submit">
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here?{" "}
        <Link className="font-medium text-blue-700 hover:text-blue-800" to="/register">
          Create an account
        </Link>
      </p>
    </AuthFrame>
  );
}

export function AuthFrame({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-emerald-600" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
            <p className="text-sm text-slate-600">TriageForge</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
}

export function Field({
  label,
  error,
  className = "",
  ...props
}: FieldProps): React.ReactElement {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className={`focus-ring h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 ${className}`}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}
