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
    if (r.ok)
      setNote("If that email is registered, a reset link is on its way.");
    else setError(j.error || "Couldn’t start a reset.");
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl">
          🏋️
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1.5">
          Trainova
        </h1>
        <p className="text-base text-white/50">Open. Lift. Log. Done.</p>
      </div>

      <div className="card space-y-4 max-w-md mx-auto w-full">
        <div className="flex overflow-hidden rounded-xl border border-white/10 text-sm font-semibold">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-3 transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
              }`}
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
          <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-white/60 border border-white/10">
            Cloud accounts aren't configured on this server yet. You can
            continue as a guest now — sign-in starts working once Supabase is
            connected.
          </p>
        )}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        {note && <p className="text-sm text-blue-400 text-center">{note}</p>}

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
            className="w-full text-center text-sm text-white/50 underline hover:text-white/70 transition-colors"
          >
            Forgot password?
          </button>
        )}
      </div>

      <button
        onClick={enterGuest}
        className="text-center text-base font-semibold text-white/50 underline underline-offset-4 hover:text-white/70 transition-colors"
      >
        Continue as guest
      </button>
    </main>
  );
}
