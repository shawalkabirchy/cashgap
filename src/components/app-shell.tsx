"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- shortcut: full document navigation avoids Windows static-export prefetch paths; restore Link when exported segment filenames match client requests. */

import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  FileText,
  CreditCard,
  Settings2,
  LockKeyhole,
  TrendingUp,
  TriangleAlert,
  RefreshCw,
  Copy,
  Download,
  Check,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Confirmation } from "./form-controls";
import { PersonalPlanDialog } from "./record-forms";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { StoredWorkspace } from "@/lib/domain";

const navigation = [
  { href: "/", label: "Overview", icon: ChartNoAxesCombined },
  { href: "/invoices/", label: "Invoices", icon: FileText },
  { href: "/expenses/", label: "Expenses", icon: CreditCard },
  { href: "/settings/", label: "Settings & data", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    stored,
    error,
    loading,
    conflict,
    pending,
    notice,
    saving,
    reload,
    continueUnsaved,
    backup,
  } = useWorkspace();
  const [personal, setPersonal] = useState<StoredWorkspace | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);
  const activePath = pathname === "/" ? "/" : `${pathname.replace(/\/$/, "")}/`;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-sidebar" aria-label="CashGap navigation">
        <a href="/" className="brand" aria-label="CashGap overview">
          <span className="brand-mark">
            <TrendingUp aria-hidden="true" />
          </span>
          <span>CashGap</span>
        </a>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              aria-label={label}
              aria-current={activePath === href ? "page" : undefined}
              className={cn(
                "nav-link",
                activePath === href && "nav-link-active",
              )}
            >
              <Icon aria-hidden="true" />
              {href === "/settings/" ? (
                <>
                  <span className="nav-label-full">{label}</span>
                  <span className="nav-label-short" aria-hidden="true">
                    Settings
                  </span>
                </>
              ) : (
                <span>{label}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-heading">
            <LockKeyhole aria-hidden="true" />
            <strong>Private by design</strong>
          </div>
          <p>
            Your numbers stay on this device. No accounts. No financial data
            uploads.
          </p>
          <Separator />
          <a
            href="https://consolelog.studio/"
            target="_blank"
            rel="noreferrer"
            className="studio-link"
          >
            Built by <strong>ConsoleLog Studio</strong>
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </aside>
      <div className="app-body">
        {stored?.isDemo ? (
          <div className="sample-banner screen-only">
            <p>
              <strong>Sample agency.</strong> A little room to explore before
              you make it yours.
            </p>
            <Button size="sm" onClick={() => setPersonal(stored)}>
              Start my own plan
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        ) : stored ? (
          <div className="personal-banner screen-only">
            <LockKeyhole aria-hidden="true" />
            <span>Your private plan · Saved only in this browser</span>
          </div>
        ) : null}
        <main id="main-content" tabIndex={-1} className="app-main">
          {(error || conflict) && stored ? (
            <Alert
              variant={error ? "destructive" : "default"}
              className="recovery-alert screen-only"
            >
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>
                {error ? "Not saved" : "Changes in another tab"}
              </AlertTitle>
              <AlertDescription>
                <p>
                  {error?.message ??
                    "Another tab saved changes. Reload the latest workspace before saving."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmReload(true)}
                  >
                    <RefreshCw data-icon="inline-start" aria-hidden="true" />
                    Reload saved workspace
                  </Button>
                  {pending ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              JSON.stringify(pending, null, 2),
                            );
                            setCopyMessage("Unsaved text copied.");
                          } catch {
                            setCopyFallback(true);
                            setCopyMessage("Select and copy the text below.");
                          }
                        }}
                      >
                        <Copy data-icon="inline-start" aria-hidden="true" />
                        Copy unsaved text
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => backup("pending")}
                      >
                        <Download data-icon="inline-start" aria-hidden="true" />
                        Export unsaved changes
                      </Button>
                    </>
                  ) : null}
                </div>
                {copyMessage ? <p role="status">{copyMessage}</p> : null}
                {copyFallback && pending ? (
                  <textarea
                    aria-label="Unsaved workspace text"
                    readOnly
                    value={JSON.stringify(pending, null, 2)}
                    onFocus={(event) => event.currentTarget.select()}
                    className="copy-fallback"
                  />
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {loading ? (
            <div className="loading-screen" role="status" aria-live="polite">
              <p>Opening your local workspace…</p>
              <Skeleton className="h-10 w-3/5" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : !stored ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Could not open local storage</AlertTitle>
              <AlertDescription>
                <p>{error?.message} Existing data has not been replaced.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void reload()}>
                    Try storage again
                  </Button>
                  <Button onClick={continueUnsaved}>
                    Explore an unsaved sample
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            children
          )}
          {stored && !loading ? (
            <footer className="app-footer screen-only">
              <span
                className={cn(
                  "save-status",
                  (error || stored.revision === 0) && "save-status-error",
                )}
              >
                {error || stored.revision === 0 ? (
                  <TriangleAlert aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                {saving
                  ? "Saving…"
                  : error || stored.revision === 0
                    ? "Not saved"
                    : "Saved on this device"}
              </span>
              <span>
                {stored.workspace.settings.currency} · CashGap by ConsoleLog
                Studio
              </span>
              <span role="status" aria-live="polite" className="sr-only">
                {notice}
              </span>
            </footer>
          ) : null}
        </main>
      </div>
      {personal ? (
        <PersonalPlanDialog base={personal} onClose={() => setPersonal(null)} />
      ) : null}
      {confirmReload ? (
        <Confirmation
          title="Reload the saved workspace?"
          description="This closes your current forms and discards unsaved edits. Copy or export them before reloading."
          confirmLabel="Reload saved workspace"
          onClose={() => setConfirmReload(false)}
          onConfirm={() => {
            window.onbeforeunload = null;
            window.location.reload();
          }}
        >
          {pending ? (
            <Button variant="outline" onClick={() => backup("pending")}>
              Export unsaved changes first
            </Button>
          ) : null}
        </Confirmation>
      ) : null}
    </div>
  );
}
