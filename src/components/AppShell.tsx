"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { SidebarNav } from "./SidebarNav";
import { BottomNav } from "./BottomNav";
import { ToastHost } from "./Toast";

/**
 * Gates the whole app shell (nav chrome + routed pages) behind an entered
 * session (guest or account). Individual pages don't each re-check this —
 * without it, sidebar/bottom nav and any route were reachable and rendered
 * their local data even before the user picked guest/sign-in on "/".
 *
 * Same gate applies to onboarding: the flow (manual and AI) renders inline
 * at "/" (see app/page.tsx) rather than its own route, so a session that
 * hasn't finished onboarding is confined to "/" exactly like no-session is —
 * nav chrome stays hidden and any other route bounces back to "/".
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const session = useStore((s) => s.session);
  const onboarded = useStore((s) => s.profile.onboarded);
  const pathname = usePathname();
  const router = useRouter();

  const needsGate = !session || !onboarded;

  useEffect(() => {
    if (hydrated && needsGate && pathname !== "/") {
      router.replace("/");
    }
  }, [hydrated, needsGate, pathname, router]);

  if (!hydrated) return <main className="min-h-screen" />;

  if (needsGate) {
    if (pathname !== "/") return <main className="min-h-screen" />;
    return (
      <main className="min-h-screen">
        <div key={pathname} className="enter-fade">
          {children}
        </div>
      </main>
    );
  }

  return (
    <div className="flex">
      <SidebarNav />
      <main className="flex-1 md:ml-64 min-h-screen">
        <div
          key={pathname}
          className="enter-fade max-w-6xl mx-auto px-4 md:px-8 lg:px-10 py-6 md:py-10 pb-24 md:pb-10"
        >
          {children}
        </div>
      </main>
      <BottomNav />
      <ToastHost />
    </div>
  );
}
