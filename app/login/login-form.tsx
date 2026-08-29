"use client";

import { useActionState } from "react";
import { Banner } from "@/components/modal";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Banner kind="error">{state.error}</Banner> : null}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" className="field" type="email" autoComplete="username" required />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          className="field"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
