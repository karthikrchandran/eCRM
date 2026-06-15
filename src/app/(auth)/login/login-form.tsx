"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/auth/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="surface mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Access the eCRM workspace.</p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="rounded-md border border-[var(--border)] px-3 py-2"
          name="email"
          required
          type="email"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input
          autoComplete="current-password"
          className="rounded-md border border-[var(--border)] px-3 py-2"
          name="password"
          required
          type="password"
        />
      </label>

      {state.error ? (
        <p className="text-sm font-medium text-red-700" id="login-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        aria-describedby={state.error ? "login-error" : undefined}
        className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
