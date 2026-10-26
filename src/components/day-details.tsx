"use client";

import {
  formatDate,
  formatMoney,
  type DayBalance,
  type Forecast,
  type Workspace,
} from "@/lib/domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DailyTable({
  result,
  currency,
  onSelect,
}: {
  result: Forecast;
  currency: Workspace["settings"]["currency"];
  onSelect: (date: string) => void;
}) {
  const money = (value: number) => formatMoney(value, currency);
  return (
    <Card className="daily-section" id="daily-breakdown">
      <CardHeader>
        <CardTitle>
          <h2>Every day, explained</h2>
        </CardTitle>
        <CardDescription>
          The same daily closing balances shown in the chart. Select a date to
          trace its calculation.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="daily-table">
          <TableCaption className="sr-only">
            Daily opening, receipts, expenses, closing balance and reserve
            status
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Incoming</TableHead>
              <TableHead className="text-right">Outgoing</TableHead>
              <TableHead className="text-right">Closing</TableHead>
              <TableHead>Reserve</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.days.map((day) => (
              <TableRow key={day.date} data-danger={day.belowReserve}>
                <TableCell>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onSelect(day.date)}
                    aria-label={`Explain ${formatDate(day.date, true)}`}
                  >
                    {formatDate(day.date)}
                  </Button>
                </TableCell>
                <TableCell className="money text-right">
                  {money(day.openingMinor)}
                </TableCell>
                <TableCell className="money text-right positive">
                  {money(day.incomingMinor)}
                </TableCell>
                <TableCell className="money text-right">
                  {money(day.outgoingMinor)}
                </TableCell>
                <TableCell className="money text-right font-medium">
                  {money(day.closingMinor)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={day.belowReserve ? "destructive" : "secondary"}
                  >
                    {day.belowReserve ? "Below reserve" : "Within reserve"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DayDetails({
  day,
  currency,
  onClose,
}: {
  day: DayBalance;
  currency: Workspace["settings"]["currency"];
  onClose: () => void;
}) {
  const money = (value: number) => formatMoney(value, currency);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="record-dialog">
        <DialogHeader>
          <DialogTitle>{formatDate(day.date, true)}</DialogTitle>
          <DialogDescription>
            Opening balance + incoming − outgoing = closing balance. Same-day
            movements are combined.
          </DialogDescription>
        </DialogHeader>
        <dl className="day-equation">
          {[
            ["Opening", day.openingMinor],
            ["Incoming", day.incomingMinor],
            ["Outgoing", day.outgoingMinor],
            ["Closing", day.closingMinor],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd className="money">{money(Number(value))}</dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="font-medium">Contributing movements</h3>
          {day.events.length ? (
            day.events.map((event) => (
              <div className="day-event" key={event.id}>
                <p>
                  {event.label}
                  {event.clientName ? <small>{event.clientName}</small> : null}
                </p>
                <span className="money">
                  {event.kind === "invoice" ? "+" : "−"}
                  {money(event.amountMinor)}
                </span>
              </div>
            ))
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No movements on this day. The previous closing balance carries
              forward.
            </p>
          )}
        </div>
        <Badge variant={day.belowReserve ? "destructive" : "secondary"}>
          {day.belowReserve ? "Below reserve" : "At or above reserve"}
        </Badge>
      </DialogContent>
    </Dialog>
  );
}

export function PrintReport({
  workspace,
  result,
  isDemo,
  isPreview,
}: {
  workspace: Workspace;
  result: Forecast;
  isDemo: boolean;
  isPreview: boolean;
}) {
  const money = (value: number) =>
    formatMoney(value, workspace.settings.currency);
  const decimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amount = (value: number) => decimal.format(value / 100);
  return (
    <section className="print-only" aria-label="Printable cash flow report">
      <h1>CashGap · Cash flow report</h1>
      <p>
        {formatDate(workspace.settings.startOn, true)} –{" "}
        {formatDate(result.days.at(-1)!.date, true)} ·{" "}
        {workspace.settings.currency} · {workspace.settings.horizonDays} days
      </p>
      <p>
        {isDemo ? "Synthetic agency sample. " : ""}
        {isPreview
          ? "Unapplied scenario preview. "
          : "Saved plan. "}Prepared {new Date().toISOString()}.
      </p>
      <p>
        Opening balance is before start-date transactions. Daily closing
        balances combine all same-day receipts and expenses; intraday shortfalls
        and bank-clearing times are not modeled. Monthly expenses retain their
        original day anchor and clamp only in short months; rule end dates are
        excluded. Payment dates are assumptions.
      </p>
      <dl>
        {[
          ["Opening balance", workspace.settings.openingMinor],
          ["Lowest closing balance", result.lowestMinor],
          ["Closing balance", result.closingMinor],
          ["Reserve", workspace.settings.reserveMinor],
          ["Initial top-up required", result.topUpMinor],
        ].map(([label, amount]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{money(Number(amount))}</dd>
          </div>
        ))}
        <div>
          <dt>First below-reserve day</dt>
          <dd>
            {result.firstBreachOn
              ? formatDate(result.firstBreachOn, true)
              : "None"}
          </dd>
        </div>
      </dl>
      <p>
        Top-up means cash added at the forecast’s start. Received invoices
        contribute only on their actual date; receipts before the start are
        already in opening balance. Cancelled invoices and overdue unscheduled
        receipts are excluded. {result.overdue.length} overdue/unscheduled
        invoice(s) excluded.
      </p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="money">Opening ({workspace.settings.currency})</th>
            <th className="money">In ({workspace.settings.currency})</th>
            <th className="money">Out ({workspace.settings.currency})</th>
            <th className="money">Closing ({workspace.settings.currency})</th>
            <th>Movements / reserve</th>
          </tr>
        </thead>
        <tbody>
          {result.days.map((day) => (
            <tr key={day.date}>
              <td>{day.date}</td>
              <td className="money">{amount(day.openingMinor)}</td>
              <td className="money">{amount(day.incomingMinor)}</td>
              <td className="money">{amount(day.outgoingMinor)}</td>
              <td className="money">{amount(day.closingMinor)}</td>
              <td>
                {day.events
                  .map(
                    (event) =>
                      `${event.kind === "invoice" ? "+" : "−"}${money(event.amountMinor)} ${event.label}`,
                  )
                  .join("; ") || "No movements"}
                {day.belowReserve ? " · BELOW RESERVE" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
