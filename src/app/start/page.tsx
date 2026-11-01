"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Welcome } from "@/components/Welcome";
import { useHydrated, useStore } from "@/lib/store";

/** Sign in, create an account or continue as a guest. With a session, the app takes over at "/". */
export default function StartPage() {
  const hydrated = useHydrated();
  const session = useStore((s) => s.session);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && session) router.replace("/");
  }, [hydrated, session, router]);

  if (!hydrated || session) return null;
  return <Welcome />;
}
