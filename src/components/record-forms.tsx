"use client";

import { useState, type FormEvent } from "react";
import {
  CashGapError,
  expenseSchema,
  invoiceSchema,
  localToday,
  moneyInput,
  settingsSchema,
  type Expense,
  type Invoice,
  type StoredWorkspace,
  type Workspace,
} from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import {
  amountField,
  FormFailure,
  getFormErrors,
  SaveButton,
  TextField,
} from "./form-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";

const blankError = { message: "", fields: {} as Record<string, string> };
const text = (data: FormData, field: string) => String(data.get(field) ?? "");

export function InvoiceEditor({
  base,
  invoice,
  initialStatus,
  onClose,
}: {
  base: StoredWorkspace;
  invoice?: Invoice;
  initialStatus?: Invoice["status"];
  onClose: () => void;
}) {
  const { commit, saving } = useWorkspace();
  const [status, setStatus] = useState<Invoice["status"]>(
    initialStatus ?? invoice?.status ?? "expected",
  );
  const [failure, setFailure] = useState(blankError);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(blankError);
    const data = new FormData(event.currentTarget);
    try {
      const now = new Date().toISOString();
      const value = invoiceSchema.parse({
        id: invoice?.id ?? crypto.randomUUID(),
        createdAt: invoice?.createdAt ?? now,
        updatedAt: now,
        label: text(data, "label"),
        ...(text(data, "clientName").trim()
          ? { clientName: text(data, "clientName").trim() }
          : {}),
        amountMinor: amountField(text(data, "amount"), "amountMinor"),
        expectedOn: text(data, "expectedOn"),
        status,
        ...(status === "received"
          ? { receivedOn: text(data, "receivedOn") }
          : {}),
      });
      const invoices = invoice
        ? base.workspace.invoices.map((item) =>
            item.id === invoice.id ? value : item,
          )
        : [...base.workspace.invoices, value];
      await commit({ ...base.workspace, invoices }, base.revision);
      onClose();
    } catch (error) {
      setFailure(getFormErrors(error));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="record-dialog">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit invoice" : "Add invoice"}</DialogTitle>
          <DialogDescription>
            Track a client payment. CashGap does not issue or send invoices.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <FieldGroup>
            <TextField
              id="invoice-label"
              name="label"
              label="Description"
              defaultValue={invoice?.label ?? ""}
              maxLength={80}
              required
              error={failure.fields.label}
              placeholder="e.g. Website redesign"
            />
            <TextField
              id="invoice-client"
              name="clientName"
              label="Client name (optional)"
              defaultValue={invoice?.clientName ?? ""}
              maxLength={80}
              error={failure.fields.clientName}
              placeholder="e.g. Juniper Co."
            />
            <TextField
              id="invoice-amount"
              name="amount"
              label={`Amount (${base.workspace.settings.currency})`}
              inputMode="decimal"
              defaultValue={invoice ? moneyInput(invoice.amountMinor) : ""}
              required
              error={failure.fields.amountMinor}
              placeholder="0.00"
            />
            <TextField
              id="invoice-date"
              name="expectedOn"
              label="Expected receipt date"
              type="date"
              defaultValue={invoice?.expectedOn ?? localToday()}
              required
              error={failure.fields.expectedOn}
            />
            <Field>
              <FieldLabel htmlFor="invoice-status">Status</FieldLabel>
              <NativeSelect
                id="invoice-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as Invoice["status"])
                }
                className="w-full"
              >
                <NativeSelectOption value="expected">
                  Expected
                </NativeSelectOption>
                <NativeSelectOption value="received">
                  Received
                </NativeSelectOption>
                <NativeSelectOption value="cancelled">
                  Cancelled
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            {status === "received" ? (
              <TextField
                id="invoice-received"
                name="receivedOn"
                label="Actual receipt date"
                type="date"
                max={localToday()}
                defaultValue={invoice?.receivedOn ?? localToday()}
                required
                error={failure.fields.receivedOn}
                hint="Counted once on this date. Earlier receipts are assumed included in opening balance."
              />
            ) : null}
          </FieldGroup>
          <FormFailure message={failure.message} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <SaveButton busy={saving}>
              {invoice ? "Save invoice" : "Add invoice"}
            </SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseEditor({
  base,
  expense,
  onClose,
}: {
  base: StoredWorkspace;
  expense?: Expense;
  onClose: () => void;
}) {
  const { commit, saving } = useWorkspace();
  const [frequency, setFrequency] = useState<Expense["frequency"]>(
    expense?.frequency ?? "once",
  );
  const [failure, setFailure] = useState(blankError);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(blankError);
    const data = new FormData(event.currentTarget);
    try {
      const now = new Date().toISOString();
      const value = expenseSchema.parse({
        id: expense?.id ?? crypto.randomUUID(),
        createdAt: expense?.createdAt ?? now,
        updatedAt: now,
        label: text(data, "label"),
        amountMinor: amountField(text(data, "amount"), "amountMinor"),
        frequency,
        startOn: text(data, "startOn"),
        ...(frequency === "monthly" && text(data, "endOn")
          ? { endOn: text(data, "endOn") }
          : {}),
      });
      const expenses = expense
        ? base.workspace.expenses.map((item) =>
            item.id === expense.id ? value : item,
          )
        : [...base.workspace.expenses, value];
      await commit({ ...base.workspace, expenses }, base.revision);
      onClose();
    } catch (error) {
      setFailure(getFormErrors(error));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="record-dialog">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            Plan a one-time payment or an anchored monthly expense.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <FieldGroup>
            <TextField
              id="expense-label"
              name="label"
              label="Description"
              defaultValue={expense?.label ?? ""}
              maxLength={80}
              required
              error={failure.fields.label}
              placeholder="e.g. Software subscriptions"
            />
            <TextField
              id="expense-amount"
              name="amount"
              label={`Amount (${base.workspace.settings.currency})`}
              inputMode="decimal"
              defaultValue={expense ? moneyInput(expense.amountMinor) : ""}
              required
              error={failure.fields.amountMinor}
              placeholder="0.00"
            />
            <Field>
              <FieldLabel htmlFor="expense-frequency">Frequency</FieldLabel>
              <NativeSelect
                id="expense-frequency"
                value={frequency}
                onChange={(event) =>
                  setFrequency(event.target.value as Expense["frequency"])
                }
                className="w-full"
              >
                <NativeSelectOption value="once">One-time</NativeSelectOption>
                <NativeSelectOption value="monthly">Monthly</NativeSelectOption>
              </NativeSelect>
            </Field>
            <TextField
              id="expense-start"
              name="startOn"
              label={
                frequency === "monthly" ? "First payment date" : "Payment date"
              }
              type="date"
              defaultValue={expense?.startOn ?? localToday()}
              required
              error={failure.fields.startOn}
              hint={
                frequency === "monthly"
                  ? "Keeps this day each month. Short months use their last day without changing the original anchor."
                  : undefined
              }
            />
            {frequency === "monthly" ? (
              <TextField
                id="expense-end"
                name="endOn"
                label="End date (optional, excluded)"
                type="date"
                defaultValue={expense?.endOn ?? ""}
                error={failure.fields.endOn}
                hint="Payments on or after this date are excluded."
              />
            ) : null}
          </FieldGroup>
          <FormFailure message={failure.message} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <SaveButton busy={saving}>
              {expense ? "Save expense" : "Add expense"}
            </SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlanForm({
  base,
  personal = false,
  onDone,
}: {
  base: StoredWorkspace;
  personal?: boolean;
  onDone?: () => void;
}) {
  const { commit, saving, backup } = useWorkspace();
  const [failure, setFailure] = useState(blankError);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const settings = personal
    ? {
        currency: "USD",
        startOn: localToday(),
        openingMinor: 0,
        reserveMinor: 0,
        horizonDays: 90,
      }
    : base.workspace.settings;
  const locked =
    !personal &&
    !!(base.workspace.invoices.length || base.workspace.expenses.length);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(blankError);
    setSaved(false);
    const data = new FormData(event.currentTarget);
    try {
      if (personal && !confirmed)
        throw new CashGapError(
          "VALIDATION_ERROR",
          "Confirm replacement of the current workspace before starting your plan.",
          { confirmation: "Confirm replacement to continue." },
        );
      const nextSettings = settingsSchema.parse({
        currency: locked ? settings.currency : text(data, "currency"),
        startOn: text(data, "startOn"),
        openingMinor: amountField(text(data, "opening"), "openingMinor", true),
        reserveMinor: amountField(text(data, "reserve"), "reserveMinor"),
        horizonDays: Number(text(data, "horizonDays")),
      });
      const workspace: Workspace = personal
        ? { settings: nextSettings, invoices: [], expenses: [] }
        : { ...base.workspace, settings: nextSettings };
      await commit(workspace, base.revision, {
        isDemo: personal ? false : base.isDemo,
        replace: personal,
      });
      setSaved(true);
      onDone?.();
    } catch (error) {
      setFailure(getFormErrors(error));
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FieldGroup>
        <Field data-disabled={locked || undefined}>
          <FieldLabel htmlFor="plan-currency">Workspace currency</FieldLabel>
          <NativeSelect
            id="plan-currency"
            name="currency"
            defaultValue={settings.currency}
            disabled={locked}
            className="w-full"
          >
            <NativeSelectOption value="USD">USD — US dollar</NativeSelectOption>
            <NativeSelectOption value="BDT">
              BDT — Bangladeshi taka
            </NativeSelectOption>
          </NativeSelect>
          <FieldDescription>
            {locked
              ? "Currency is locked while financial records exist. A new plan can use a different currency."
              : "All records use this currency. No currency conversion is performed."}
          </FieldDescription>
        </Field>
        <TextField
          id="plan-start"
          name="startOn"
          label="Forecast start date"
          type="date"
          defaultValue={settings.startOn}
          required
          error={failure.fields.startOn}
        />
        <TextField
          id="plan-opening"
          name="opening"
          label="Opening balance"
          inputMode="decimal"
          defaultValue={moneyInput(settings.openingMinor)}
          required
          error={failure.fields.openingMinor}
          hint="Your balance before transactions on the start date. Negative balances are allowed."
        />
        <TextField
          id="plan-reserve"
          name="reserve"
          label="Reserve threshold"
          inputMode="decimal"
          defaultValue={moneyInput(settings.reserveMinor)}
          required
          error={failure.fields.reserveMinor}
          hint="A closing balance below this amount is a danger day."
        />
        <Field>
          <FieldLabel htmlFor="plan-horizon">Forecast horizon</FieldLabel>
          <NativeSelect
            id="plan-horizon"
            name="horizonDays"
            defaultValue={settings.horizonDays}
            className="w-full"
          >
            {[30, 90, 180, 365].map((days) => (
              <NativeSelectOption key={days} value={days}>
                {days} days
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {personal ? (
          <Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => backup("saved")}
            >
              <Download data-icon="inline-start" aria-hidden="true" />
              Export current workspace first
            </Button>
            <Field
              orientation="horizontal"
              data-invalid={!!failure.fields.confirmation}
            >
              <Checkbox
                id="plan-confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                aria-invalid={!!failure.fields.confirmation}
              />
              <FieldLabel htmlFor="plan-confirm">
                Replace all current records with my new empty plan.
              </FieldLabel>
            </Field>
          </Field>
        ) : null}
      </FieldGroup>
      <FormFailure message={failure.message} />
      {saved ? (
        <p role="status" className="text-sm text-primary">
          Plan settings saved on this device.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onDone ? (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onDone}
          >
            Cancel
          </Button>
        ) : null}
        <SaveButton busy={saving}>
          {personal ? "Replace with my plan" : "Save plan settings"}
        </SaveButton>
      </div>
    </form>
  );
}

export function PersonalPlanDialog({
  base,
  onClose,
}: {
  base: StoredWorkspace;
  onClose: () => void;
}) {
  const { saving } = useWorkspace();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="record-dialog">
        <DialogHeader>
          <DialogTitle>Make room for your own plan</DialogTitle>
          <DialogDescription>
            Choose your starting point. Replacing the workspace removes its
            current records only after you confirm and the save succeeds.
          </DialogDescription>
        </DialogHeader>
        <PlanForm base={base} personal onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}
