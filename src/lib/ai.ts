"use client";

import { useEffect, useState } from "react";
import { apiFetch, fetchMeCached, isSignedIn } from "@/lib/auth";

let statusPromise: Promise<boolean> | null = null;

function fetchAvailable(): Promise<boolean> {
  statusPromise ??= fetch("/api/ai/status", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { available: false }))
    .then((j: { available?: boolean }) => j.available === true)
    .catch(() => {
      statusPromise = null; // retry on next mount (e.g. came back online)
      return false;
    });
  return statusPromise;
}

export type AiStatus = {
  /** null while the server is being asked. */
  available: boolean | null;
  signedIn: boolean;
  /** Whether the account allowed AI data sharing (null while unknown). */
  consented: boolean | null;
};

// Components re-read consent when it changes anywhere (Profile or an AI gate).
const consentListeners = new Set<() => void>();

/** Record the AI data-sharing choice on the account and refresh every gate. */
export async function setAiConsent(allow: boolean): Promise<boolean> {
  try {
    const r = await apiFetch("/api/account/privacy", { method: "POST", body: JSON.stringify({ aiConsent: allow }) });
    if (!r.ok) return false;
    await fetchMeCached(true);
    consentListeners.forEach((fn) => fn());
    return true;
  } catch {
    return false;
  }
}

/** Runtime AI availability (server has a key) plus whether this user can call it. */
export function useAiStatus(): AiStatus {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [consented, setConsented] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const account = isSignedIn();
    setSignedIn(account);
    fetchAvailable().then((a) => live && setAvailable(a));
    const readConsent = () => {
      if (account) fetchMeCached().then((me) => live && setConsented(me ? Boolean(me.aiConsent) : null));
      else setConsented(false);
    };
    readConsent();
    consentListeners.add(readConsent);
    return () => {
      live = false;
      consentListeners.delete(readConsent);
    };
  }, []);
  return { available, signedIn, consented };
}

/** Authenticated JSON POST to an AI route. Throws an Error with the server's message. */
export class AiError extends Error {
  constructor(message: string, readonly code: string | null) {
    super(message);
  }
}

export async function postAi<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  if (!isSignedIn()) throw new AiError("Sign in to use the AI coach.", "UNAUTHORIZED");
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body), signal });
  const json = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!res.ok) throw new AiError(json?.error ?? "The coach couldn't answer. Try again.", json?.code ?? null);
  return json as T;
}
