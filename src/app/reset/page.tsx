"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(j.error || "Reset failed.");
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
      {!token ? (
        <p className="text-muted">This reset link is missing its token.</p>
      ) : done ? (
        <>
          <p className="text-accent">Password updated. You can sign in now.</p>
          <Link href="/" className="btn-primary w-full">
            Go to sign in
          </Link>
        </>
      ) : (
        <div className="card space-y-3">
          <input
            className="input"
            type="password"
            placeholder="New password (6+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            className="btn-primary w-full py-3"
            disabled={busy || password.length < 6}
            onClick={submit}
          >
            {busy ? "…" : "Update password"}
          </button>
        </div>
      )}
    </main>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<main className="p-6 text-muted">Loading…</main>}>
      <ResetForm />
    </Suspense>
  );
}
