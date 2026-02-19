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
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-xs">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-white">Jesse A. Eisenbalm</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-widest text-muted">
              Automation Dashboard
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-edge bg-surface p-7">
          <h1 className="mb-1 text-base font-semibold text-white">Sign in</h1>
          <p className="mb-6 text-xs text-muted leading-relaxed">
            Enter your dashboard password to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-edge bg-raised px-3 py-2.5 text-sm text-white placeholder-muted/50 transition-colors focus:border-amber/50 focus:outline-none focus:ring-2 focus:ring-amber/10"
            />

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-lg bg-amber px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-40"
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted/40">
          Stop. Breathe. Balm.
        </p>
      </div>
    </div>
  );
}
