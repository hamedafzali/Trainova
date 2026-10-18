"use client";

import { useState } from "react";
import { BarChart3, Dumbbell, Eye, EyeOff, ListChecks, WifiOff } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useStore } from "@/lib/store";
import { isCloudEnabled, signIn, signUp } from "@/lib/auth";
import { mergeRemote, pullState, pushState } from "@/lib/sync";

const FEATURES = [
  { icon: ListChecks, title: "Ready-made programs", body: "Start from a proven plan or build your own." },
  { icon: Dumbbell, title: "100+ exercises", body: "Machines, free weights and cardio, with how-to steps." },
  { icon: BarChart3, title: "Automatic progression", body: "Know exactly what to lift next time." },
  { icon: WifiOff, title: "Works offline", body: "Log in the gym basement; it syncs later." },
];

/**
 * First screen: sign in / create an account, or continue as a guest
 * (local-only). Guest is always available so there's zero friction to start.
 */
export function Welcome() {
  const enterGuest = useStore((s) => s.enterGuest);
  const enterAccount = useStore((s) => s.enterAccount);
  const cloud = isCloudEnabled();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError =
    emailTouched && email.trim() && !emailValid ? "Enter a valid email address" : null;
  const passwordError =
    mode === "up" && passwordTouched && password && password.length < 8
      ? "Use at least 8 characters"
      : null;
  const canSubmit =
    cloud && !busy && emailValid && password.length > 0 && !(mode === "up" && password.length < 8);

  const forgot = async () => {
    setError(null);
    setNote(null);
    if (!emailValid) {
      setError("Enter your email above first.");
      return;
    }
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setNote("If that email is registered, a reset link is on its way.");
      else setError(j.error || "Couldn’t start a reset.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      const who =
        mode === "up" ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
      // Merge the account copy with anything logged on this device, then
      // publish the result so both sides agree.
      const remote = await pullState();
      if (remote) mergeRemote(remote);
      await pushState();
      enterAccount(who.email, who.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen md:grid md:grid-cols-2">
      <section className="night-card rounded-none px-6 pb-20 pt-12 md:flex md:flex-col md:justify-center md:px-14 md:py-16">
        <svg
          viewBox="0 0 512 512"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-20 -z-10 h-80 w-80 -rotate-12 text-white opacity-[0.05] md:h-[30rem] md:w-[30rem]"
        >
          <rect x="78" y="112" width="44" height="124" rx="14" />
          <rect x="130" y="134" width="30" height="80" rx="10" />
          <rect x="352" y="134" width="30" height="80" rx="10" />
          <rect x="390" y="112" width="44" height="124" rx="14" />
          <rect x="150" y="154" width="212" height="40" rx="10" />
          <rect x="224" y="174" width="64" height="230" rx="32" />
        </svg>
        <div className="relative mx-auto max-w-md text-center md:mx-0 md:text-left">
          <LogoMark className="mx-auto mb-6 h-14 w-14 shadow-[0_10px_30px_-8px_rgb(var(--c-accent)/0.7)] md:mx-0" />
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-volt">Strength training, logged</p>
          <h1 className="font-display text-[3rem] font-extrabold leading-none tracking-[-0.03em] md:text-[4rem]">Trainova</h1>
          <p className="mt-4 text-body text-white/75">
            Follow a plan, log every set in seconds and watch your strength climb.
          </p>
          <ul className="mt-10 hidden space-y-5 md:block">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-white/10 text-volt ring-1 ring-inset ring-white/10">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{f.title}</span>
                  <span className="block text-sm text-white/65">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative z-10 -mt-10 flex flex-col gap-6 px-4 pb-12 md:mt-0 md:justify-center md:px-12">
        <form
          onSubmit={submit}
          noValidate
          className="card mx-auto w-full max-w-md space-y-4 shadow-elevated md:shadow-none md:border-0 md:bg-transparent"
        >
          <div role="tablist" className="flex overflow-hidden rounded-control border border-border text-sm font-semibold">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 py-3 transition-colors ${
                  mode === m ? "bg-accentFill text-onAccent" : "bg-surface2 text-inkSoft hover:bg-border/60"
                }`}
              >
                {m === "in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="welcome-email" className="text-sm font-medium text-inkSoft">
              Email
            </label>
            <input
              id="welcome-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              aria-invalid={Boolean(emailError)}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
            />
            {emailError && <p className="text-xs text-danger">{emailError}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="welcome-password" className="text-sm font-medium text-inkSoft">
              Password
            </label>
            <div className="relative">
              <input
                id="welcome-password"
                className="input pr-12"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                placeholder={mode === "up" ? "At least 8 characters" : "Your password"}
                value={password}
                aria-invalid={Boolean(passwordError)}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
          </div>

          {!cloud && (
            <p className="rounded-control border border-border bg-surface2 px-4 py-3 text-sm text-inkSoft">
              Accounts aren&apos;t enabled on this server. Continue as a guest — your data stays on
              this device.
            </p>
          )}
          {error && (
            <p role="alert" className="text-center text-sm text-danger">
              {error}
            </p>
          )}
          {note && (
            <p role="status" className="text-center text-sm text-accent">
              {note}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-4" disabled={!canSubmit}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </button>

          {cloud && mode === "in" && (
            <button
              type="button"
              onClick={forgot}
              className="w-full text-center text-sm text-inkSoft underline hover:text-ink"
            >
              Forgot password?
            </button>
          )}

          <div className="flex items-center gap-3 pt-2 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <button type="button" onClick={enterGuest} className="btn-secondary w-full py-3.5">
            Continue as guest
          </button>
          <p className="text-center text-xs text-muted">
            Guest data stays on this device. Create an account any time to back it up.
          </p>
        </form>
      </section>
    </main>
  );
}
