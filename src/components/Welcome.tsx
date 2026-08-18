"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
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
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError =
    emailTouched && email.trim() && !emailValid
      ? "Enter a valid email address"
      : null;
  const passwordError =
    mode === "up" && passwordTouched && password && password.length < 6
      ? "Password must be at least 6 characters"
      : null;

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
    <main className="flex min-h-screen flex-col">
      <div className="relative overflow-hidden bg-gradient-to-br from-accentPressed via-accent to-accentHover px-6 pb-20 pt-16 text-center sm:pb-24 sm:pt-20">
        <Dumbbell
          aria-hidden
          strokeWidth={1.25}
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 -rotate-12 text-onAccent/10 sm:h-52 sm:w-52"
        />
        <Dumbbell
          aria-hidden
          strokeWidth={1.25}
          className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rotate-[20deg] text-onAccent/10 sm:h-44 sm:w-44"
        />
        <p className="section-label mb-3 text-onAccent/70">
          Strength training, logged
        </p>
        <h1 className="text-hero text-onAccent">Trainova</h1>
        <p className="mt-3 text-body text-onAccent/85">
          Open. Lift. Log. Done.
        </p>
      </div>

      <div className="relative z-10 -mt-10 flex flex-col gap-10 px-6 pb-12 sm:-mt-12">
      <div className="card space-y-4 max-w-md mx-auto w-full shadow-elevated">
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
          onBlur={() => setEmailTouched(true)}
        />
        {emailError && <p className="text-xs text-danger">{emailError}</p>}
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
          onBlur={() => setPasswordTouched(true)}
        />
        {passwordError && <p className="text-xs text-danger">{passwordError}</p>}

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
          disabled={
            busy ||
            !cloud ||
            !email ||
            !password ||
            !emailValid ||
            (mode === "up" && password.length < 6)
          }
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
      </div>
    </main>
  );
}
