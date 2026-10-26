import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/geist";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "CashGap — A clearer picture of your cash",
  description:
    "A private cash-flow planner for small agencies. Explore payment timing, protect your reserve, and see the gaps before they arrive.",
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
