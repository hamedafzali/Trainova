"use client";

import { isCloudEnabled } from "./supabase/client";
import { useStore } from "./store";

export { isCloudEnabled };

// The session lives in an HttpOnly cookie that JavaScript can't read. Older
// builds kept a bearer token in localStorage; it's sent once to /api/auth/me,
// which swaps it for the cookie, and is then deleted.
const LEGACY_TOKEN_KEY = "trainova-token";

function legacyToken(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(LEGACY_TOKEN_KEY);
  } catch {
    return null;
  }
}

function dropLegacyToken() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** True when the user is signed in to an account (cookie session). */
export function isSignedIn(): boolean {
  return useStore.getState().session?.mode === "account";
}

/** Signed-out locally after the server rejected the session. */
export function handleUnauthorized() {
  dropLegacyToken();
  if (isSignedIn()) useStore.getState().leaveSession();
}

/**
 * fetch() for our own API: sends the session cookie, plus the legacy bearer
 * while one still exists. JSON bodies get the content-type header.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const legacy = legacyToken();
  if (legacy && !headers.has("authorization")) headers.set("authorization", `Bearer ${legacy}`);
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

export type AuthResult = { email: string; role: "user" | "trainer" | "admin" };
export type Me = AuthResult & {
  aiConsent: { at: string; version: string | null } | null;
  analyticsOptOut: boolean;
};

/** Current account; also completes the legacy-token → cookie migration. */
export async function fetchMe(): Promise<Me | null> {
  try {
    const r = await apiFetch("/api/auth/me");
    if (r.status === 401) {
      handleUnauthorized();
      return null;
    }
    if (!r.ok) return null;
    dropLegacyToken();
    return (await r.json()) as Me;
  } catch {
    return null; // offline
  }
}

let mePromise: Promise<Me | null> | null = null;

/** fetchMe shared across components; `refresh` after changing settings. */
export function fetchMeCached(refresh = false): Promise<Me | null> {
  if (refresh || !mePromise) mePromise = fetchMe().then((me) => (me ? me : ((mePromise = null), null)));
  return mePromise;
}

async function post(path: string, body: unknown): Promise<AuthResult> {
  const r = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}) as Record<string, string>);
  if (!r.ok) throw new Error(j.error || "Request failed");
  dropLegacyToken();
  return { email: j.email, role: j.role ?? "user" };
}

export const signUp = (email: string, password: string) => post("/api/auth/signup", { email, password });
export const signIn = (email: string, password: string) => post("/api/auth/login", { email, password });

/** Ends the session on the server; `everywhere` revokes every device. */
export async function signOut(opts: { everywhere?: boolean } = {}): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify(opts) });
  } catch {
    /* offline: the cookie still expires; local state is cleared by the caller */
  }
  dropLegacyToken();
}
