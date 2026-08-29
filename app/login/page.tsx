import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <p className="mb-8 text-center font-display text-4xl text-pine">Points Engine</p>
        <div className="rounded-2xl border border-line bg-cream p-8 shadow-card">
          <h1 className="mb-1 font-display text-2xl">Sign in</h1>
          <p className="mb-6 text-[14px] text-muted">Staff only. There is no sign-up.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
