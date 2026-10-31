"use client";

import { useEffect } from "react";
import { listenForInstall } from "@/lib/install";

/** Registers the offline service worker once on the client, and starts listening for the install prompt. */
export function ServiceWorker() {
  useEffect(() => {
    listenForInstall();
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort */
    });
  }, []);
  return null;
}
