"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-beige bg-white p-8">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mb-6 text-sm text-stone">Enter your password to continue.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="rounded-lg border border-beige bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="rounded-lg bg-ink px-4 py-2 text-sm text-cream hover:bg-charcoal disabled:opacity-40"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
