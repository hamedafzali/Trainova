import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { SidebarNav } from "@/components/SidebarNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { SyncManager } from "@/components/SyncManager";

export const metadata: Metadata = {
  title: "Trainova",
  description: "Fast, offline-friendly strength training tracker.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Trainova" },
};

export const viewport: Viewport = {
  themeColor: "#F4ECE1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg">
        <ServiceWorker />
        <SyncManager />
        <div className="flex">
          <SidebarNav />
          <main className="flex-1 md:ml-64 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-24 md:pb-8">
              {children}
            </div>
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
