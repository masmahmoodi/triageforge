import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";

import {
  registerRequestSchema,
  type AuthResponse
} from "@triageforge/contracts";
import { register } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { Button } from "../components/Button";
import { AuthFrame, Field } from "./LoginPage";

type RegisterValues = Parameters<typeof register>[0];

export function RegisterPage(): React.ReactElement {
  const { user, isLoading, establishSession } = useAuth();
  const navigate = useNavigate();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      email: "",
      name: "",
      password: ""
    }
  });
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (response: AuthResponse) => {
      establishSession(response);
      void navigate("/", { replace: true });
    }
  });

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthFrame title="Create account">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          void form.handleSubmit((values) =>
            mutation.mutate({
              ...values,
              name: values.name?.trim() || undefined
            })
          )(event);
        }}
      >
        <Field
          label="Name"
          type="text"
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />
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
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link className="font-medium text-blue-700 hover:text-blue-800" to="/login">
          Log in
        </Link>
      </p>
    </AuthFrame>
  );
}
