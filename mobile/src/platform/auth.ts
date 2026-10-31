// Native stand-in for src/lib/auth.ts (swapped in by metro.config.js; keep the
// exports identical). The web keeps its session in an HttpOnly cookie; the app
// has no cookie jar it can rely on, so the server hands it the same token in a
// header and it lives in the device keychain, sent back as a bearer.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useStore } from "@/lib/store";
import { API_URL } from "./config";

const TOKEN_KEY = "trainova-session";
let token: string | null = null;
let loaded = false;

const webStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

/** Reads the saved token once, before the first request. */
export async function loadToken(): Promise<void> {
  if (loaded) return;
  token = Platform.OS === "web" ? webStore.get() : await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  loaded = true;
}

async function saveToken(next: string | null) {
  token = next;
  if (Platform.OS === "web") return webStore.set(next);
  if (next) await SecureStore.setItemAsync(TOKEN_KEY, next);
  else await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
}

/** The accounts server is always there for the app. */
export function isCloudEnabled(): boolean {
  return true;
}

export function isSignedIn(): boolean {
  return useStore.getState().session?.mode === "account";
}

/** Signed out locally after the server rejected the session. */
export function handleUnauthorized() {
  void saveToken(null);
  if (isSignedIn()) useStore.getState().leaveSession();
}

/** fetch() for the Trainova API with the bearer token; JSON bodies get the content-type. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await loadToken();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  headers.set("x-trainova-client", "native");
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  return fetch(API_URL + path, { ...init, headers, credentials: "omit" });
}

export type AuthResult = { email: string; role: "user" | "trainer" | "admin" };
export type Me = AuthResult & {
  aiConsent: { at: string; version: string | null } | null;
  analyticsOptOut: boolean;
};

export async function fetchMe(): Promise<Me | null> {
  try {
    const r = await apiFetch("/api/auth/me");
    if (r.status === 401) {
      handleUnauthorized();
      return null;
    }
    if (!r.ok) return null;
    return (await r.json()) as Me;
  } catch {
    return null; // offline
  }
}

let mePromise: Promise<Me | null> | null = null;

export function fetchMeCached(refresh = false): Promise<Me | null> {
  if (refresh || !mePromise) mePromise = fetchMe().then((me) => (me ? me : ((mePromise = null), null)));
  return mePromise;
}

async function post(path: string, body: unknown): Promise<AuthResult> {
  let r: Response;
  try {
    r = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  } catch {
    throw new Error("Can't reach Trainova. Check your connection.");
  }
  const j = await r.json().catch(() => ({}) as Record<string, string>);
  if (!r.ok) throw new Error(j.error || "Request failed");
  const issued = r.headers.get("x-session-token");
  if (!issued) throw new Error("The server didn't start a session. Update the server and try again.");
  await saveToken(issued);
  return { email: j.email, role: j.role ?? "user" };
}

export const signUp = (email: string, password: string) => post("/api/auth/signup", { email, password });
export const signIn = (email: string, password: string) => post("/api/auth/login", { email, password });

export async function signOut(opts: { everywhere?: boolean } = {}): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify(opts) });
  } catch {
    /* offline: the token is dropped locally either way */
  }
  await saveToken(null);
}
