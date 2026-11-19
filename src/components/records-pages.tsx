"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import {
  formatDate,
  formatMoney,
  type Expense,
  type Invoice,
  type StoredWorkspace,
} from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { Confirmation } from "./form-controls";
import { ExpenseEditor, InvoiceEditor } from "./record-forms";
import { SegmentedControl } from "./segmented-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusLabel = (invoice: Invoice) =>
  invoice.status[0].toUpperCase() + invoice.status.slice(1);

export function InvoicesPage() {
  const { stored, commit, saving } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<{
    base: StoredWorkspace;
    invoice?: Invoice;
    initialStatus?: Invoice["status"];
  } | null>(null);
  const [remove, setRemove] = useState<{
    base: StoredWorkspace;
    invoice: Invoice;
  } | null>(null);
  if (!stored) return null;
  const { workspace } = stored;
  const money = (value: number) =>
    formatMoney(value, workspace.settings.currency);
  const invoices = workspace.invoices
    .filter((invoice) => filter === "all" || invoice.status === filter)
    .toSorted((a, b) => a.expectedOn.localeCompare(b.expectedOn));
  const expected = workspace.invoices.filter(
    (invoice) => invoice.status === "expected",
  );
  const received = workspace.invoices.filter(
    (invoice) => invoice.status === "received",
  ).length;
  const outstanding = expected.reduce(
    (total, invoice) => total + invoice.amountMinor,
    0,
  );
  const isOverdue = (invoice: Invoice) =>
    invoice.status === "expected" &&
    invoice.expectedOn < workspace.settings.startOn;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>
            {workspace.invoices.length
              ? `${expected.length} expected · ${money(outstanding)} still to receive · ${received} received`
              : `No invoices yet · Amounts in ${workspace.settings.currency}`}
          </p>
        </div>
        <Button disabled={saving} onClick={() => setEditor({ base: stored })}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add invoice
        </Button>
      </header>
      <Card className="table-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>
                <h2>Saved invoices</h2>
              </CardTitle>
              <CardDescription>
                {workspace.invoices.length} of 500 records · Amounts in{" "}
                {workspace.settings.currency}
              </CardDescription>
            </div>
            <div className="invoice-toolbar">
              <SegmentedControl
                aria-label="Filter invoice status"
                value={filter}
                onValueChange={setFilter}
                options={[
                  { value: "all", label: "All", ariaLabel: "All statuses" },
                  { value: "expected", label: "Expected" },
                  { value: "received", label: "Received" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {invoices.length ? (
            <Table className="movement-table">
              <TableCaption className="sr-only">
                Saved invoice records, including dates outside this forecast
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="col-wide">Expected</TableHead>
                  <TableHead className="col-wide">
                    Status / actual date
                  </TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="table-description">
                      {invoice.label}
                      {invoice.clientName ? (
                        <small>{invoice.clientName}</small>
                      ) : null}
                      <span className="cell-meta col-compact">
                        {invoice.receivedOn
                          ? `Received ${formatDate(invoice.receivedOn, true)}`
                          : invoice.status === "cancelled"
                            ? `Cancelled · expected ${formatDate(invoice.expectedOn, true)}`
                            : `Expected ${formatDate(invoice.expectedOn, true)}`}
                      </span>
                      {isOverdue(invoice) ? (
                        <span className="cell-sub cell-sub-warning col-compact">
                          Overdue and unscheduled
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="col-wide">
                      {formatDate(invoice.expectedOn, true)}
                      {isOverdue(invoice) ? (
                        <span className="cell-sub cell-sub-warning">
                          Overdue and unscheduled
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="col-wide">
                      <Badge
                        variant={
                          invoice.status === "received"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {statusLabel(invoice)}
                      </Badge>
                      {invoice.receivedOn ? (
                        <span className="cell-sub">
                          {formatDate(invoice.receivedOn, true)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className={`money text-right ${invoice.status === "cancelled" ? "amount-cancelled" : ""}`}
                    >
                      {money(invoice.amountMinor)}
                    </TableCell>
                    <TableCell>
                      <div className="record-actions">
                        {invoice.status === "expected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={saving}
                            onClick={() =>
                              setEditor({
                                base: stored,
                                invoice,
                                initialStatus: "received",
                              })
                            }
                            aria-label={`Mark ${invoice.label} received`}
                          >
                            <Check
                              data-icon="inline-start"
                              aria-hidden="true"
                            />
                            <span className="action-label">Mark received</span>
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={saving}
                          aria-label={`Edit ${invoice.label}`}
                          onClick={() => setEditor({ base: stored, invoice })}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={saving}
                          aria-label={`Delete ${invoice.label}`}
                          onClick={() => setRemove({ base: stored, invoice })}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {filter === "all"
                    ? "No invoices yet"
                    : "No invoices with this status"}
                </EmptyTitle>
                <EmptyDescription>
                  {filter === "all"
                    ? "Add an expected client payment to include it in the forecast."
                    : "Choose another status or add an invoice."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <p className="page-note">
        Received invoices count on their actual date, once. Earlier receipts are
        assumed included in opening balance. Cancelled invoices do not
        contribute. This is a tracker, not an invoice-issuing service.
      </p>
      {editor ? (
        <InvoiceEditor {...editor} onClose={() => setEditor(null)} />
      ) : null}
      {remove ? (
        <Confirmation
          title="Delete this invoice?"
          description={`“${remove.invoice.label}” will be removed from your plan and forecast. This cannot be undone.`}
          confirmLabel="Delete invoice"
          destructive
          onClose={() => setRemove(null)}
          onConfirm={() =>
            commit(
              {
                ...remove.base.workspace,
                invoices: remove.base.workspace.invoices.filter(
                  (invoice) => invoice.id !== remove.invoice.id,
                ),
              },
              remove.base.revision,
            )
          }
        />
      ) : null}
    </>
  );
}

export function ExpensesPage() {
  const { stored, commit, saving } = useWorkspace();
  const [editor, setEditor] = useState<{
    base: StoredWorkspace;
    expense?: Expense;
  } | null>(null);
  const [remove, setRemove] = useState<{
    base: StoredWorkspace;
    expense: Expense;
  } | null>(null);
  if (!stored) return null;
  const { workspace } = stored;
  const money = (value: number) =>
    formatMoney(value, workspace.settings.currency);
  const rules = workspace.expenses.filter(
    (expense) => expense.frequency === "monthly",
  );
  const monthly = rules.length;
  const monthlyTotal = rules
    .filter((rule) => !rule.endOn || rule.endOn > workspace.settings.startOn)
    .reduce((total, rule) => total + rule.amountMinor, 0);
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>
            {workspace.expenses.length
              ? `${workspace.expenses.length - monthly} one-time · ${monthly} monthly ${monthly === 1 ? "rule" : "rules"} · ${money(monthlyTotal)} a month in active rules`
              : `No expenses yet · Amounts in ${workspace.settings.currency}`}
          </p>
        </div>
        <Button disabled={saving} onClick={() => setEditor({ base: stored })}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add expense
        </Button>
      </header>
      <Card className="table-card">
        <CardHeader>
          <CardTitle>
            <h2>Saved expenses</h2>
          </CardTitle>
          <CardDescription>
            {workspace.expenses.length - monthly} of 500 one-time expenses ·{" "}
            {monthly} of 50 monthly rules · {workspace.settings.currency}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {workspace.expenses.length ? (
            <Table className="movement-table">
              <TableCaption className="sr-only">
                Saved one-time expenses and anchored monthly rules
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="col-wide">
                    First / payment date
                  </TableHead>
                  <TableHead className="col-wide">Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.expenses
                  .toSorted((a, b) => a.startOn.localeCompare(b.startOn))
                  .map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="table-description">
                        {expense.label}
                        {expense.endOn ? (
                          <small>
                            Ends before {formatDate(expense.endOn, true)}
                          </small>
                        ) : null}
                        <span className="cell-meta col-compact">
                          {expense.frequency === "monthly"
                            ? `Monthly from ${formatDate(expense.startOn, true)}`
                            : `One-time on ${formatDate(expense.startOn, true)}`}
                        </span>
                      </TableCell>
                      <TableCell className="col-wide">
                        {formatDate(expense.startOn, true)}
                      </TableCell>
                      <TableCell className="col-wide">
                        <Badge
                          variant={
                            expense.frequency === "monthly"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {expense.frequency === "monthly"
                            ? "Monthly"
                            : "One-time"}
                        </Badge>
                        {expense.frequency === "monthly" ? (
                          <span className="cell-sub">
                            Day {Number(expense.startOn.slice(-2))}, earlier in
                            short months
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="money text-right">
                        {money(expense.amountMinor)}
                      </TableCell>
                      <TableCell>
                        <div className="record-actions">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={saving}
                            aria-label={`Edit ${expense.label}`}
                            onClick={() => setEditor({ base: stored, expense })}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={saving}
                            aria-label={`Delete ${expense.label}`}
                            onClick={() => setRemove({ base: stored, expense })}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No expenses yet</EmptyTitle>
                <EmptyDescription>
                  Add payroll, contractor payments, software, or another planned
                  expense.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <p className="page-note">
        Monthly rules preserve the original day of month. A January 31 rule uses
        February’s last day, then March 31. End dates are excluded. Expenses
        before the forecast start are assumed covered by opening balance.
      </p>
      {editor ? (
        <ExpenseEditor {...editor} onClose={() => setEditor(null)} />
      ) : null}
      {remove ? (
        <Confirmation
          title="Delete this expense?"
          description={`“${remove.expense.label}” and its future scheduled occurrences will be removed. This cannot be undone.`}
          confirmLabel="Delete expense"
          destructive
          onClose={() => setRemove(null)}
          onConfirm={() =>
            commit(
              {
                ...remove.base.workspace,
                expenses: remove.base.workspace.expenses.filter(
                  (expense) => expense.id !== remove.expense.id,
                ),
              },
              remove.base.revision,
            )
          }
        />
      ) : null}
    </>
  );
}
