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
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
  const invoices = workspace.invoices
    .filter((invoice) => filter === "all" || invoice.status === filter)
    .toSorted((a, b) => a.expectedOn.localeCompare(b.expectedOn));
  return (
    <>
      <header className="page-header">
        <div>
          <h1>A plan for every payment.</h1>
          <p>
            Track what clients owe, when you expect it, and when it actually
            arrives.
          </p>
        </div>
        <Button disabled={saving} onClick={() => setEditor({ base: stored })}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add invoice
        </Button>
      </header>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>
                <h2>Invoices</h2>
              </CardTitle>
              <CardDescription>
                {workspace.invoices.length} of 500 records · All amounts in{" "}
                {workspace.settings.currency}
              </CardDescription>
            </div>
            <NativeSelect
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter invoice status"
            >
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
              <NativeSelectOption value="expected">Expected</NativeSelectOption>
              <NativeSelectOption value="received">Received</NativeSelectOption>
              <NativeSelectOption value="cancelled">
                Cancelled
              </NativeSelectOption>
            </NativeSelect>
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
                  <TableHead>Expected</TableHead>
                  <TableHead>Status / actual date</TableHead>
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
                    </TableCell>
                    <TableCell>
                      {formatDate(invoice.expectedOn, true)}
                      {invoice.status === "expected" &&
                      invoice.expectedOn < workspace.settings.startOn ? (
                        <small className="block text-warning">
                          Overdue & unscheduled
                        </small>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "received"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {invoice.status[0].toUpperCase() +
                          invoice.status.slice(1)}
                      </Badge>
                      {invoice.receivedOn ? (
                        <small className="mt-1 block text-muted-foreground">
                          {formatDate(invoice.receivedOn, true)}
                        </small>
                      ) : null}
                    </TableCell>
                    <TableCell className="money text-right">
                      {formatMoney(
                        invoice.amountMinor,
                        workspace.settings.currency,
                      )}
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
                            Receive
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
                    ? "Your next payment starts here"
                    : "No invoices with this status"}
                </EmptyTitle>
                <EmptyDescription>
                  {filter === "all"
                    ? "Add an expected client payment to begin your cash-flow forecast."
                    : "Choose another status or add an invoice."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
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
  const monthly = workspace.expenses.filter(
    (expense) => expense.frequency === "monthly",
  ).length;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Know what’s going out.</h1>
          <p>
            Keep one-time commitments and recurring costs in the same clear
            picture.
          </p>
        </div>
        <Button disabled={saving} onClick={() => setEditor({ base: stored })}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add expense
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Expenses</h2>
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
                  <TableHead>First / payment date</TableHead>
                  <TableHead>Frequency</TableHead>
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
                      </TableCell>
                      <TableCell>{formatDate(expense.startOn, true)}</TableCell>
                      <TableCell>
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
                          <small className="mt-1 block text-muted-foreground">
                            Day {Number(expense.startOn.slice(-2))}, clamped in
                            short months
                          </small>
                        ) : null}
                      </TableCell>
                      <TableCell className="money text-right">
                        {formatMoney(
                          expense.amountMinor,
                          workspace.settings.currency,
                        )}
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
                <EmptyTitle>Give your costs a date</EmptyTitle>
                <EmptyDescription>
                  Add payroll, contractor payments, software, or another planned
                  expense.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
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
