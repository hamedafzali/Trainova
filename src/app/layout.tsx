import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="mx-auto min-h-dvh max-w-md pb-24">
        <ServiceWorker />
        <SyncManager />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
