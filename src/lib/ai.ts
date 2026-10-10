"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

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
};

/** Runtime AI availability (server has a key) plus whether this user can call it. */
export function useAiStatus(): AiStatus {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    setSignedIn(Boolean(getToken()));
    fetchAvailable().then((a) => live && setAvailable(a));
    return () => {
      live = false;
    };
  }, []);
  return { available, signedIn };
}

/** Authenticated JSON POST to an AI route. Throws an Error with the server's message. */
export async function postAi<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Sign in to use the AI coach.");
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json as { error?: string } | null)?.error ?? "The coach couldn't answer. Try again.");
  return json as T;
}
