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
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok)
        setNote("If that email is registered, a reset link is on its way.");
      else setError(j.error || "Couldn’t start a reset.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const who =
        mode === "up"
          ? await signUp(email.trim(), password)
          : await signIn(email.trim(), password);
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
    <main className="flex min-h-screen flex-col justify-center gap-8 p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-accent text-2xl">
          🏋️
        </div>
        <h1 className="text-h1 text-ink mb-1.5">Trainova</h1>
        <p className="text-body text-inkSoft">Open. Lift. Log. Done.</p>
      </div>

      <div className="card space-y-4 max-w-md mx-auto w-full">
        <div className="flex overflow-hidden rounded-control border border-border text-sm font-semibold">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-3 transition-colors ${
                mode === m
                  ? "bg-accentFill text-onAccent"
                  : "bg-surface2 text-inkSoft hover:bg-border/60"
              }`}
            >
              {m === "in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <label htmlFor="welcome-email" className="sr-only">
          Email
        </label>
        <input
          id="welcome-email"
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="welcome-password" className="sr-only">
          Password
        </label>
        <input
          id="welcome-password"
          className="input"
          type="password"
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {!cloud && (
          <p className="rounded-control bg-surface2 px-4 py-3 text-sm text-inkSoft border border-border">
            Cloud accounts aren't configured on this server yet. You can
            continue as a guest now — sign-in starts working once Supabase is
            connected.
          </p>
        )}
        {error && <p className="text-sm text-danger text-center">{error}</p>}
        {note && <p className="text-sm text-accent text-center">{note}</p>}

        <button
          className="btn-primary w-full py-4"
          disabled={busy || !cloud || !email || !password}
          onClick={submit}
        >
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>

        {cloud && mode === "in" && (
          <button
            onClick={forgot}
            className="w-full text-center text-sm text-inkSoft underline hover:text-ink transition-colors"
          >
            Forgot password?
          </button>
        )}
      </div>

      <button
        onClick={enterGuest}
        className="text-center text-base font-semibold text-inkSoft underline underline-offset-4 hover:text-ink transition-colors"
      >
        Continue as guest
      </button>
    </main>
  );
}
