"use client";

import { getSupabase, isCloudEnabled } from "./supabase/client";

// Thin wrappers over Supabase Auth. When no Supabase project is configured these
// throw a friendly error and the UI falls back to Guest mode.

export { isCloudEnabled };

export async function signUp(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud accounts aren’t set up yet — continue as guest.");
  const { error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud accounts aren’t set up yet — continue as guest.");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
