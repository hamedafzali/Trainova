"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { isCloudEnabled, signIn, signUp } from "@/lib/auth";
import { applySnapshot, pullState, pushState } from "@/lib/sync";

/**
 * First screen: sign in / create an account (Supabase Auth when configured), or
 * continue as guest (local-only). Guest is always available so there's zero
 * friction to start training.
 */
export function Welcome() {
  const enterGuest = useStore((s) => s.enterGuest);
  const enterAccount = useStore((s) => s.enterAccount);
  const cloud = isCloudEnabled();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forgot = async () => {
    setError(null);
    setNote(null);
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    const r = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setNote("If that email is registered, a reset link is on its way.");
    else setError(j.error || "Couldn’t start a reset.");
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const who =
        mode === "up" ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
      // Sync: if the account already has data, load it; otherwise migrate this
      // device's local data up to the new account.
      const remote = await pullState();
      if (remote) applySnapshot(remote);
      else await pushState();
      enterAccount(who.email, who.role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-3xl text-onAccent">
          🏋️
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Trainova</h1>
        <p className="mt-1 text-muted">Open. Lift. Log. Done.</p>
      </header>

      <div className="card space-y-3">
        <div className="flex overflow-hidden rounded-xl border border-border text-sm font-semibold">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 ${mode === m ? "bg-accent text-onAccent" : "bg-surface2 text-inkSoft"}`}
            >
              {m === "in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <input
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {!cloud && (
          <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-inkSoft">
            Cloud accounts aren’t configured on this server yet. You can continue as a guest now —
            sign-in starts working once Supabase is connected.
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {note && <p className="text-xs text-accent">{note}</p>}

        <button
          className="btn-primary w-full py-3"
          disabled={busy || !cloud || !email || !password}
          onClick={submit}
        >
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>

        {cloud && mode === "in" && (
          <button onClick={forgot} className="w-full text-center text-xs text-muted underline">
            Forgot password?
          </button>
        )}
      </div>

      <button
        onClick={enterGuest}
        className="text-center text-sm font-semibold text-inkSoft underline underline-offset-4"
      >
        Continue as guest
      </button>
    </main>
  );
}
