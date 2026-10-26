"use client";

import { useState } from "react";
import {
  Download,
  FileInput,
  FolderSync,
  HardDrive,
  LockKeyhole,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { createSample } from "@/lib/sample";
import type { StoredWorkspace } from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { Confirmation } from "./form-controls";
import { PlanForm, PersonalPlanDialog } from "./record-forms";
import { DataDialog } from "./data-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SettingsPage() {
  const { stored, commit, backup, saving } = useWorkspace();
  const [transfer, setTransfer] = useState<{
    mode: "csv" | "restore";
    base: StoredWorkspace;
  } | null>(null);
  const [reset, setReset] = useState<StoredWorkspace | null>(null);
  const [personal, setPersonal] = useState<StoredWorkspace | null>(null);
  if (!stored) return null;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Your plan. Your data.</h1>
          <p>
            Set your starting point, bring in records, and keep a backup close.
          </p>
        </div>
      </header>
      <div className="settings-grid">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Plan settings</h2>
            </CardTitle>
            <CardDescription>
              A forecast is only as useful as the assumptions behind it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanForm base={stored} key={stored.revision} />
          </CardContent>
        </Card>
        <div className="settings-data">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Import & backup</h2>
              </CardTitle>
              <CardDescription>
                Local files in. Local files out. Your data stays yours.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="data-action">
                <Download aria-hidden="true" />
                <div className="flex-1">
                  <h3>Export JSON backup</h3>
                  <p>
                    A complete, restorable copy of your settings, invoices, and
                    expenses.
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => backup("saved")}
                >
                  Export
                </Button>
              </div>
              <Separator />
              <div className="data-action">
                <FileInput aria-hidden="true" />
                <div className="flex-1">
                  <h3>Import CSV</h3>
                  <p>
                    Add expected invoices and one-time expenses. Review all rows
                    before one atomic save.
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => setTransfer({ mode: "csv", base: stored })}
                >
                  Import CSV
                </Button>
              </div>
              <Separator />
              <div className="data-action">
                <FolderSync aria-hidden="true" />
                <div className="flex-1">
                  <h3>Restore JSON backup</h3>
                  <p>
                    Validate a CashGap backup and explicitly replace the current
                    workspace.
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => setTransfer({ mode: "restore", base: stored })}
                >
                  Restore backup
                </Button>
              </div>
            </CardContent>
          </Card>
          <Alert>
            <HardDrive aria-hidden="true" />
            <AlertTitle>This browser is storage, not a backup</AlertTitle>
            <AlertDescription>
              Clearing site data, private browsing, or browser eviction can
              remove your workspace. Export a JSON backup regularly. CashGap
              does not sync between devices or browsers.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>A fresh starting point</h2>
              </CardTitle>
              <CardDescription>
                Every replacement asks first. Export a backup before starting
                over.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setPersonal(stored)}
              >
                <Sparkles data-icon="inline-start" aria-hidden="true" />
                Start a new personal plan
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setReset(stored)}
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
                Reset to sample agency
              </Button>
            </CardContent>
          </Card>
          <div className="flex items-start gap-3 px-1 text-xs leading-relaxed text-muted-foreground">
            <LockKeyhole
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              No analytics, session replay, bank connection, or financial-data
              API. CashGap is a deterministic planner built by ConsoleLog
              Studio.
            </p>
          </div>
        </div>
      </div>
      {transfer ? (
        <DataDialog {...transfer} onClose={() => setTransfer(null)} />
      ) : null}
      {personal ? (
        <PersonalPlanDialog base={personal} onClose={() => setPersonal(null)} />
      ) : null}
      {reset ? (
        <Confirmation
          title="Replace with the sample agency?"
          description="This removes your current records and loads synthetic agency data with a new forecast starting today. Export a backup first if you want to keep your current plan."
          confirmLabel="Replace with sample data"
          onClose={() => setReset(null)}
          onConfirm={() =>
            commit(createSample(), reset.revision, {
              replace: true,
              isDemo: true,
            })
          }
        >
          <Button variant="outline" onClick={() => backup("saved")}>
            Export current workspace first
          </Button>
        </Confirmation>
      ) : null}
    </>
  );
}
