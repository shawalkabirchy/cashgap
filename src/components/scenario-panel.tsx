"use client";

import { useState } from "react";
import { ArrowRight, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  CashGapError,
  formatDate,
  formatMoney,
  shiftInvoices,
  type Forecast,
  type Invoice,
  type StoredWorkspace,
  type Workspace,
} from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { getFormErrors } from "./form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function InvoiceChoice({
  invoice,
  checked,
  onChange,
  currency,
  prefix,
}: {
  invoice: Invoice;
  checked: boolean;
  onChange: (checked: boolean) => void;
  currency: Workspace["settings"]["currency"];
  prefix: string;
}) {
  const id = `${prefix}-${invoice.id}`;
  return (
    <div className="scenario-option">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <FieldLabel htmlFor={id}>
        <span className="scenario-option-label">
          {invoice.label}
          {invoice.clientName ? ` · ${invoice.clientName}` : ""}
        </span>
        <small>Expected {formatDate(invoice.expectedOn)}</small>
      </FieldLabel>
      <span className="scenario-amount">
        {formatMoney(invoice.amountMinor, currency)}
      </span>
    </div>
  );
}

export type ScenarioPreview = {
  workspace: Workspace;
  revision: number;
  ids: string[];
  days: number;
};

export function ScenarioPanel({
  base,
  result,
  preview,
  onPreview,
}: {
  base: StoredWorkspace;
  result: Forecast;
  preview: ScenarioPreview | null;
  onPreview: (preview: ScenarioPreview | null) => void;
}) {
  const { commit, saving } = useWorkspace();
  const expected = base.workspace.invoices.filter(
    (invoice) => invoice.status === "expected",
  );
  const [selected, setSelected] = useState<string[]>(
    expected[0] ? [expected[0].id] : [],
  );
  const [shift, setShift] = useState("14");
  const [failure, setFailure] = useState("");
  const [selecting, setSelecting] = useState(false);
  const chosen = expected.filter((invoice) => selected.includes(invoice.id));
  const summary = chosen.length ? chosen.slice(0, 1) : expected.slice(0, 1);
  const select = (id: string, checked: boolean) =>
    setSelected((previous) =>
      checked ? [...previous, id] : previous.filter((value) => value !== id),
    );
  const money = (value: number) =>
    formatMoney(value, base.workspace.settings.currency);
  return (
    <Card className="scenario-panel">
      <CardHeader>
        <CardTitle>
          <h2>What if a client pays late?</h2>
        </CardTitle>
        <CardDescription>
          Preview a payment delay before you change your plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFailure("");
            try {
              if (!/^-?\d+$/.test(shift))
                throw new CashGapError(
                  "VALIDATION_ERROR",
                  "Enter a whole number of days between −365 and +365.",
                );
              onPreview({
                workspace: shiftInvoices(
                  base.workspace,
                  selected,
                  Number(shift),
                ),
                revision: base.revision,
                ids: selected,
                days: Number(shift),
              });
            } catch (error) {
              setFailure(getFormErrors(error).message);
            }
          }}
        >
          <FieldGroup className="gap-3">
            <FieldSet className="gap-1" disabled={!!preview || saving}>
              <FieldLegend className="sr-only">
                Expected invoices to move
              </FieldLegend>
              {expected.length ? (
                summary.map((invoice) => (
                  <InvoiceChoice
                    key={invoice.id}
                    invoice={invoice}
                    checked={selected.includes(invoice.id)}
                    onChange={(checked) => select(invoice.id, checked)}
                    currency={base.workspace.settings.currency}
                    prefix="summary"
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add an expected invoice to explore a payment scenario.
                </p>
              )}
              {expected.length > 1 ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="self-start px-0"
                  onClick={() => setSelecting(true)}
                >
                  Choose invoices
                  {selected.length > 1 ? ` (${selected.length} selected)` : ""}
                </Button>
              ) : null}
            </FieldSet>
            <Field>
              <div className="scenario-shift">
                <FieldLabel htmlFor="scenario-shift">
                  Shift payment by
                </FieldLabel>
                <Input
                  id="scenario-shift"
                  inputMode="numeric"
                  value={shift}
                  onChange={(event) => setShift(event.target.value)}
                  disabled={!!preview || saving}
                  aria-describedby="scenario-shift-hint"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p
                id="scenario-shift-hint"
                className="text-xs text-muted-foreground"
              >
                Positive delays; negative brings forward.
              </p>
            </Field>
          </FieldGroup>
          {failure ? (
            <Alert variant="destructive">
              <AlertTitle>Check this scenario</AlertTitle>
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}
          {preview ? (
            <>
              <Badge variant="outline">
                Unapplied preview · {preview.days > 0 ? "+" : ""}
                {preview.days} days
              </Badge>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={saving}
                  className="flex-1"
                  onClick={async () => {
                    try {
                      const now = new Date().toISOString();
                      await commit(
                        {
                          ...preview.workspace,
                          invoices: preview.workspace.invoices.map((invoice) =>
                            preview.ids.includes(invoice.id)
                              ? { ...invoice, updatedAt: now }
                              : invoice,
                          ),
                        },
                        preview.revision,
                      );
                      onPreview(null);
                      setFailure("");
                    } catch (error) {
                      setFailure(getFormErrors(error).message);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Apply scenario"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    onPreview(null);
                    setFailure("");
                  }}
                >
                  Cancel preview
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="submit"
              className="w-full"
              disabled={!selected.length || saving}
            >
              Preview scenario
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          )}
        </form>
        <Separator />
        <Alert
          className="reserve-insight"
          data-danger={result.dangerDays > 0}
          role="status"
        >
          {result.dangerDays ? (
            <TriangleAlert aria-hidden="true" />
          ) : (
            <ShieldCheck aria-hidden="true" />
          )}
          <AlertTitle>
            {result.dangerDays ? "A gap worth planning for" : "Room to breathe"}
          </AlertTitle>
          <AlertDescription>
            {result.dangerDays ? (
              <>
                {result.dangerDays} {result.dangerDays === 1 ? "day" : "days"}{" "}
                below reserve. Add{" "}
                <strong data-testid="top-up">{money(result.topUpMinor)}</strong>{" "}
                at the forecast’s start to stay at or above reserve.
              </>
            ) : (
              <>
                Initial top-up: <strong data-testid="top-up">{money(0)}</strong>
                . Your forecast stays at or above the{" "}
                {money(base.workspace.settings.reserveMinor)} reserve.
              </>
            )}
          </AlertDescription>
        </Alert>
        <Dialog open={selecting} onOpenChange={setSelecting}>
          <DialogContent className="record-dialog">
            <DialogHeader>
              <DialogTitle>Choose expected invoices</DialogTitle>
              <DialogDescription>
                Every selected invoice moves by the same number of days.
                Received and cancelled invoices stay put.
              </DialogDescription>
            </DialogHeader>
            <FieldSet className="scenario-picker-options">
              <FieldLegend className="sr-only">Expected invoices</FieldLegend>
              {expected.map((invoice) => (
                <InvoiceChoice
                  key={invoice.id}
                  invoice={invoice}
                  checked={selected.includes(invoice.id)}
                  onChange={(checked) => select(invoice.id, checked)}
                  currency={base.workspace.settings.currency}
                  prefix="picker"
                />
              ))}
            </FieldSet>
            <Button onClick={() => setSelecting(false)}>
              Done choosing invoices
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
