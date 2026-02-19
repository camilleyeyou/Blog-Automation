"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/queue", {
      headers: { "x-dashboard-password": password },
    });

    if (res.ok) {
      localStorage.setItem("dashboard_password", password);
      router.push("/dashboard");
    } else {
      setError("Incorrect password.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-xs">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <div className="text-sm font-semibold tracking-tight text-ink">
            Jesse A. Eisenbalm
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-stone">
            Blog Automation
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-beige bg-white p-7 shadow-card-md">
          <h1 className="mb-1 text-base font-semibold text-ink">Sign in</h1>
          <p className="mb-6 text-xs text-stone leading-relaxed">
            Enter your dashboard password to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-beige bg-cream px-3 py-2.5 text-sm placeholder-stone/40 transition-colors focus:border-stone focus:outline-none focus:ring-2 focus:ring-stone/20"
            />

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-charcoal disabled:opacity-40"
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[10px] text-stone/50">
          Stop. Breathe. Balm.
        </p>
      </div>
    </div>
  );
}
