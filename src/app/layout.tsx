import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@fontsource-variable/geist";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "CashGap — Cash-flow planner for small agencies",
  description:
    "A private cash-flow planner for small agencies. Forecast daily balances, test late client payments, and keep your cash above its reserve.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f8f7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
