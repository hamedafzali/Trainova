"use client";

import { useEffect, useState } from "react";
import { isCloudEnabled } from "@/lib/supabase/client";

/** Tiny status pill: shows offline state and whether cloud sync is configured. */
export function OnlineBadge() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const cloud = isCloudEnabled();
  const label = !online ? "Offline" : cloud ? "Synced" : "Local";
  const dot = !online ? "bg-danger" : cloud ? "bg-accent" : "bg-muted";

  return (
    <span className="chip inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
