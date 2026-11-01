"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LANDING_PATH, SIGN_IN_PATH } from "@/lib/paths";
import { useHydrated, useStore } from "@/lib/store";
import { SidebarNav } from "./SidebarNav";
import { BottomNav } from "./BottomNav";
import { ToastHost } from "./Toast";

/** Pages anyone can open without a session. Full-bleed, no nav chrome. */
const PUBLIC_PATHS = new Set([LANDING_PATH, SIGN_IN_PATH, "/reset"]);

/**
 * Gates the whole app shell (nav chrome + routed pages) behind an entered
 * session (guest or account). Individual pages don't each re-check this —
 * without it, sidebar/bottom nav and any route were reachable and rendered
 * their local data even before the user picked guest/sign-in.
 *
 * Without a session, "/" shows the introduction and any other route bounces
 * to the sign-in page. Onboarding (manual and AI) renders inline at "/" (see
 * app/page.tsx) rather than its own route, so a session that hasn't finished
 * it is confined to "/" — nav chrome stays hidden and other routes bounce back.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const session = useStore((s) => s.session);
  const onboarded = useStore((s) => s.profile.onboarded);
  const pathname = usePathname();
  const router = useRouter();

  const open = PUBLIC_PATHS.has(pathname);
  const needsGate = !open && (!session || !onboarded);
  // Focus mode: a live workout gets the whole screen on every device.
  const liveId = pathname.startsWith("/session/") ? pathname.split("/")[2] : null;
  const focus = useStore((s) => (liveId ? s.sessions.some((x) => x.id === liveId && x.status === "active") : false));

  useEffect(() => {
    if (hydrated && needsGate && pathname !== "/") {
      router.replace(session ? "/" : SIGN_IN_PATH);
    }
  }, [hydrated, needsGate, pathname, router, session]);

  // Served before hydration too, so the first paint (and crawlers) get the content.
  if (pathname === LANDING_PATH) return <main className="min-h-screen">{children}</main>;

  if (!hydrated) return <main className="min-h-screen" />;

  if (needsGate || open) {
    if (needsGate && pathname !== "/") return <main className="min-h-screen" />;
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
      {!focus && <SidebarNav />}
      <main className={`flex-1 min-w-0 min-h-screen ${focus ? "" : "md:ml-64"}`}>
        <div
          key={pathname}
          className="enter-fade max-w-6xl mx-auto px-4 md:px-8 lg:px-10 py-6 md:py-10 pb-32 md:pb-10"
        >
          {children}
        </div>
      </main>
      <BottomNav />
      <ToastHost />
    </div>
  );
}
