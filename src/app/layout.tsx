import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ServiceWorker } from "@/components/ServiceWorker";
import { SyncManager } from "@/components/SyncManager";
import { NO_FLASH_THEME_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Trainova",
  description: "Fast, offline-friendly strength training tracker.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Trainova" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0d" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg">
        <ServiceWorker />
        <SyncManager />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
