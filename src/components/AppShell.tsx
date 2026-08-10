"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { SidebarNav } from "./SidebarNav";
import { BottomNav } from "./BottomNav";

/**
 * Gates the whole app shell (nav chrome + routed pages) behind an entered
 * session (guest or account). Individual pages don't each re-check this —
 * without it, sidebar/bottom nav and any route were reachable and rendered
 * their local data even before the user picked guest/sign-in on "/".
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const session = useStore((s) => s.session);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !session && pathname !== "/") {
      router.replace("/");
    }
  }, [hydrated, session, pathname, router]);

  if (!hydrated) return <main className="min-h-screen" />;

  if (!session) {
    if (pathname !== "/") return <main className="min-h-screen" />;
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex">
      <SidebarNav />
      <main className="flex-1 md:ml-64 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 md:px-8 lg:px-10 py-6 md:py-10 pb-24 md:pb-10">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
