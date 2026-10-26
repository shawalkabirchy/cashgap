"use client";

import { useState, type ChangeEvent } from "react";
import {
  addDays,
  CashGapError,
  formatMoney,
  type StoredWorkspace,
  type Workspace,
} from "@/lib/domain";
import {
  BACKUP_LIMIT,
  CSV_LIMIT,
  downloadText,
  previewCsv,
  readBackup,
  type CsvPreview,
} from "@/lib/transfers";
import { useWorkspace } from "./workspace-provider";
import { Confirmation, getFormErrors } from "./form-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataDialog({
  mode,
  base,
  onClose,
}: {
  mode: "csv" | "restore";
  base: StoredWorkspace;
  onClose: () => void;
}) {
  const { commit, saving, backup } = useWorkspace();
  const [reading, setReading] = useState(false);
  const [failure, setFailure] = useState("");
  const [csv, setCsv] = useState<CsvPreview | null>(null);
  const [restored, setRestored] = useState<Workspace | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFailure("");
    setCsv(null);
    setRestored(null);
    if (!file) return;
    setReading(true);
    try {
      if (!file.name.toLowerCase().endsWith(mode === "csv" ? ".csv" : ".json"))
        throw new CashGapError(
          "FILE_UNSUPPORTED",
          `Choose a ${mode === "csv" ? ".csv" : ".json"} file.`,
        );
      if (file.size > (mode === "csv" ? CSV_LIMIT : BACKUP_LIMIT))
        throw new CashGapError(
          "FILE_TOO_LARGE",
          `Choose a file no larger than ${mode === "csv" ? "1" : "10"} MiB.`,
        );
      const contents = await file.text();
      if (mode === "csv") setCsv(previewCsv(contents, base.workspace));
      else setRestored(readBackup(contents));
    } catch (error) {
      setFailure(getFormErrors(error).message);
    } finally {
      setReading(false);
    }
  }
  const candidate = mode === "csv" ? csv?.workspace : restored;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving && !reading) onClose();
      }}
    >
      <DialogContent className="record-dialog sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "csv"
              ? "Import cash movements"
              : "Restore a CashGap backup"}
          </DialogTitle>
          <DialogDescription>
            {mode === "csv"
              ? "Preview every import before saving. A single invalid row prevents all writes."
              : "Validate the backup before replacing the current workspace. Restoration replaces records; it does not merge."}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="data-file">
            {mode === "csv" ? "CSV file" : "CashGap backup file"}
          </FieldLabel>
          <Input
            id="data-file"
            type="file"
            accept={mode === "csv" ? ".csv,text/csv" : ".json,application/json"}
            onChange={(event) => void choose(event)}
            disabled={reading || saving}
          />
          <FieldDescription>
            {mode === "csv"
              ? "Up to 500 rows and 1 MiB. Columns: type,label,clientName,amount,date. Amounts use your workspace currency."
              : "CashGap P05 format version 1 · Up to 10 MiB."}{" "}
            The file stays on your device.
          </FieldDescription>
        </Field>
        {mode === "csv" ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="self-start"
            onClick={() =>
              downloadText(
                `type,label,clientName,amount,date\ninvoice,New client payment,Example client,1000.00,${addDays(base.workspace.settings.startOn, 7)}\nexpense,One-time service,,300.00,${addDays(base.workspace.settings.startOn, 10)}\n`,
                "cashgap-example.csv",
                "text/csv;charset=utf-8",
              )
            }
          >
            Download an example CSV
          </Button>
        ) : null}
        {reading ? (
          <p role="status">Reading and validating on your device…</p>
        ) : null}
        {failure ? (
          <Alert variant="destructive">
            <AlertTitle>Nothing was imported</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}
        {csv?.errors.length ? (
          <Alert variant="destructive">
            <AlertTitle>
              Nothing was imported · {csv.errors.length} issue(s)
            </AlertTitle>
            <AlertDescription>
              <ul className="flex max-h-44 list-disc flex-col gap-2 overflow-y-auto pl-4">
                {csv.errors.map((error, index) => (
                  <li key={index}>
                    {error.row ? `Row ${error.row}: ` : "Workspace: "}
                    {error.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {candidate ? (
          <div className="flex flex-col gap-4" role="status">
            <p className="text-sm font-medium">
              {mode === "csv"
                ? `Ready to add ${csv!.invoiceCount} invoice(s) and ${csv!.expenseCount} expense(s).`
                : `Valid backup: ${candidate.invoices.length} invoice(s), ${candidate.expenses.length} expense rule(s), ${candidate.settings.currency}.`}
            </p>
            {mode === "csv" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...candidate.invoices
                      .slice(base.workspace.invoices.length)
                      .map((invoice) => ({
                        label: invoice.label,
                        date: invoice.expectedOn,
                        amount: invoice.amountMinor,
                      })),
                    ...candidate.expenses
                      .slice(base.workspace.expenses.length)
                      .map((expense) => ({
                        label: expense.label,
                        date: expense.startOn,
                        amount: expense.amountMinor,
                      })),
                  ]
                    .slice(0, 5)
                    .map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="table-description">
                          {row.label}
                        </TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell className="money text-right">
                          {formatMoney(row.amount, candidate.settings.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Current records will be replaced only after your next
                confirmation. Existing data remains intact if validation or
                storage fails.
              </p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={saving || reading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={!candidate || saving || reading}
            onClick={async () => {
              if (!candidate) return;
              if (mode === "restore") {
                setConfirmRestore(true);
                return;
              }
              try {
                await commit(candidate, base.revision);
                onClose();
              } catch (error) {
                setFailure(getFormErrors(error).message);
              }
            }}
          >
            {saving
              ? "Saving…"
              : mode === "csv"
                ? "Import all valid rows"
                : "Review replacement"}
          </Button>
        </div>
        {confirmRestore && restored ? (
          <Confirmation
            title="Replace current workspace?"
            description={`Replace ${base.workspace.invoices.length} invoice(s) and ${base.workspace.expenses.length} expense rule(s) with this backup. There is no automatic undo. Export your current data first.`}
            confirmLabel="Replace current workspace"
            onClose={() => setConfirmRestore(false)}
            onConfirm={async () => {
              await commit(restored, base.revision, {
                replace: true,
                isDemo: false,
              });
              onClose();
            }}
          >
            <Button variant="outline" onClick={() => backup("saved")}>
              Export current workspace first
            </Button>
          </Confirmation>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
