"use client";

import { isCloudEnabled } from "./supabase/client";

export { isCloudEnabled };

const TOKEN_KEY = "trainova-token";

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export type AuthResult = { email: string; role: "user" | "trainer" | "admin" };

async function post(
  path: string,
  body: unknown
): Promise<{ token: string; email: string; role: AuthResult["role"] }> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}) as Record<string, string>);
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j as { token: string; email: string; role: AuthResult["role"] };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const j = await post("/api/auth/signup", { email, password });
  setToken(j.token);
  return { email: j.email, role: j.role ?? "user" };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const j = await post("/api/auth/login", { email, password });
  setToken(j.token);
  return { email: j.email, role: j.role ?? "user" };
}

export async function signOut(): Promise<void> {
  clearToken();
}
