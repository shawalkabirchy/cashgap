"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Plus,
  Printer,
  TriangleAlert,
} from "lucide-react";
import {
  forecast,
  formatDate,
  formatMoney,
  HORIZONS,
  type StoredWorkspace,
} from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { InvoiceEditor } from "./record-forms";
import { ScenarioPanel, type ScenarioPreview } from "./scenario-panel";
import { DailyTable, DayDetails, PrintReport } from "./day-details";
import { SegmentedControl } from "./segmented-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

const ForecastChart = dynamic(() => import("./forecast-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});

export function Dashboard() {
  const { stored, commit, saving, backup } = useWorkspace();
  const [editor, setEditor] = useState<{
    base: StoredWorkspace;
    invoiceId?: string;
  } | null>(null);
  const [preview, setPreview] = useState<ScenarioPreview | null>(null);
  const [showDaily, setShowDaily] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const baseline = useMemo(
    () => (stored ? forecast(stored.workspace) : null),
    [stored],
  );
  const result = useMemo(
    () => (preview ? forecast(preview.workspace) : baseline),
    [preview, baseline],
  );
  if (!stored || !result || !baseline) return null;
  const workspace = preview?.workspace ?? stored.workspace;
  const settings = workspace.settings;
  const money = (value: number) => formatMoney(value, settings.currency);
  const end = result.days.at(-1)!.date;
  const movements = result.days.flatMap((day) =>
    day.events.map((event) => ({ ...event, date: day.date })),
  );
  const day = result.days.find((day) => day.date === selectedDay);
  const headroom = result.lowestMinor - settings.reserveMinor;
  const plan = preview
    ? {
        lowest:
          baseline.lowestMinor !== result.lowestMinor
            ? money(baseline.lowestMinor)
            : null,
        breach:
          baseline.firstBreachOn !== result.firstBreachOn
            ? baseline.firstBreachOn
              ? formatDate(baseline.firstBreachOn, true)
              : "no breach"
            : null,
        closing:
          baseline.closingMinor !== result.closingMinor
            ? money(baseline.closingMinor)
            : null,
      }
    : null;
  return (
    <>
      <div className="screen-only">
        <header className="page-header">
          <div>
            <h1>Cash-flow forecast</h1>
            <p>
              {settings.horizonDays} days from{" "}
              {formatDate(settings.startOn, true)} · {settings.currency} ·
              Reserve {money(settings.reserveMinor)}
            </p>
          </div>
          <div className="header-actions">
            <Button variant="outline" onClick={() => backup("saved")}>
              <Download data-icon="inline-start" aria-hidden="true" />
              Export backup
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" aria-hidden="true" />
              Print report
            </Button>
            <Button onClick={() => setEditor({ base: stored })}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Add invoice
            </Button>
          </div>
        </header>
        {failure ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}
        <dl
          className="metrics"
          aria-label={preview ? "Scenario preview summary" : "Forecast summary"}
        >
          <div className="metric">
            <dt>Opening balance</dt>
            <dd>
              <span data-testid="metric-opening">
                {money(settings.openingMinor)}
              </span>
              <small>{formatDate(settings.startOn, true)}</small>
            </dd>
          </div>
          <div className="metric">
            <dt>Lowest closing balance</dt>
            <dd data-tone={headroom < 0 ? "warning" : undefined}>
              <span data-testid="metric-lowest">
                {money(result.lowestMinor)}
              </span>
              <small data-tone={headroom < 0 ? "warning" : undefined}>
                {formatDate(result.lowestOn, true)} ·{" "}
                {headroom === 0
                  ? "at reserve"
                  : `${money(Math.abs(headroom))} ${headroom > 0 ? "above" : "below"} reserve`}
              </small>
              {plan?.lowest ? (
                <small className="metric-plan">Saved plan: {plan.lowest}</small>
              ) : null}
            </dd>
          </div>
          <div className="metric">
            <dt>First reserve breach</dt>
            <dd
              className="metric-text"
              data-tone={result.firstBreachOn ? "warning" : undefined}
            >
              <span data-testid="metric-breach">
                {result.firstBreachOn
                  ? formatDate(result.firstBreachOn, true)
                  : "None in this forecast"}
              </span>
              <small>
                {result.dangerDays
                  ? `${result.dangerDays} day${result.dangerDays === 1 ? "" : "s"} below reserve`
                  : "Every day at or above reserve"}
              </small>
              {plan?.breach ? (
                <small className="metric-plan">Saved plan: {plan.breach}</small>
              ) : null}
            </dd>
          </div>
          <div className="metric">
            <dt>Closing balance</dt>
            <dd>
              <span data-testid="metric-closing">
                {money(result.closingMinor)}
              </span>
              <small>{formatDate(end, true)}</small>
              {plan?.closing ? (
                <small className="metric-plan">Saved plan: {plan.closing}</small>
              ) : null}
            </dd>
          </div>
        </dl>
        {result.overdue.length ? (
          <Alert className="mb-6">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>
              Overdue and unscheduled invoices · {result.overdue.length}
            </AlertTitle>
            <AlertDescription>
              <p>
                These expected dates are before your forecast start. Reschedule
                them to include the receipts.
              </p>
              <div className="flex flex-wrap gap-2">
                {result.overdue.map((invoice) => (
                  <Button
                    key={invoice.id}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditor({ base: stored, invoiceId: invoice.id })
                    }
                  >
                    {invoice.label} · {money(invoice.amountMinor)}
                  </Button>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="dashboard-grid">
          <Card className="chart-card">
            <CardHeader>
              <div className="chart-header">
                <div>
                  <CardTitle>
                    <h2>Daily closing balance</h2>
                  </CardTitle>
                  <p className="chart-subtitle">
                    {formatDate(settings.startOn, true)} –{" "}
                    {formatDate(end, true)} · {settings.currency}
                  </p>
                </div>
                <SegmentedControl
                  aria-label="Forecast horizon"
                  value={String(settings.horizonDays)}
                  disabled={saving || !!preview}
                  options={HORIZONS.map((days) => ({
                    value: String(days),
                    label: `${days} days`,
                  }))}
                  onValueChange={async (value) => {
                    try {
                      await commit({
                        ...stored.workspace,
                        settings: {
                          ...stored.workspace.settings,
                          horizonDays: Number(
                            value,
                          ) as typeof settings.horizonDays,
                        },
                      });
                      setFailure("");
                    } catch (error) {
                      setFailure(
                        error instanceof Error
                          ? error.message
                          : "Could not save the forecast horizon.",
                      );
                    }
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="chart-frame">
                <ForecastChart
                  result={result}
                  baseline={preview ? baseline : undefined}
                  settings={settings}
                  onSelect={setSelectedDay}
                />
              </div>
              <div className="chart-key">
                <span>
                  <span className="legend-line" aria-hidden="true" />
                  {preview ? "Scenario preview" : "Projected closing balance"}
                </span>
                {preview ? (
                  <span>
                    <span
                      className="legend-line legend-baseline"
                      aria-hidden="true"
                    />
                    Saved plan
                  </span>
                ) : null}
                <span>
                  <span
                    className="legend-line legend-reserve"
                    aria-hidden="true"
                  />
                  Reserve
                </span>
                <span>
                  <span className="legend-zone" aria-hidden="true" />
                  Below reserve
                </span>
                <span className="chart-hint">
                  Select a day to see its movements
                </span>
              </div>
            </CardContent>
          </Card>
          <ScenarioPanel
            base={stored}
            result={result}
            preview={preview}
            onPreview={setPreview}
          />
        </div>
        <Card className="table-card">
          <CardHeader>
            <CardTitle>
              <h2>Upcoming cash movements</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {movements.length ? (
              <Table className="movement-table upcoming-table">
                <TableCaption className="sr-only">
                  The first six cash movements in this forecast
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="col-wide">Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.slice(0, 6).map((event) => (
                    <TableRow key={`${event.id}-${event.date}`}>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setSelectedDay(event.date)}
                          aria-label={`Explain ${formatDate(event.date, true)}`}
                        >
                          <span className="date-full">
                            {formatDate(event.date, true)}
                          </span>
                          <span className="date-short">
                            {formatDate(event.date)}
                          </span>
                        </Button>
                      </TableCell>
                      <TableCell className="table-description">
                        {event.label}
                        {event.clientName ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {event.clientName}
                          </span>
                        ) : null}
                        <span className="cell-meta col-compact">
                          {event.kind === "invoice" ? "Invoice" : "Expense"}
                        </span>
                      </TableCell>
                      <TableCell className="col-wide">
                        <Badge
                          variant={
                            event.kind === "invoice" ? "secondary" : "outline"
                          }
                        >
                          {event.kind === "invoice" ? "Invoice" : "Expense"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`money text-right ${event.kind === "invoice" ? "positive" : ""}`}
                      >
                        {event.kind === "expense" ? "−" : "+"}
                        {money(event.amountMinor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No cash movements in this forecast</EmptyTitle>
                  <EmptyDescription>
                    Add expected client payments and scheduled expenses to see
                    them here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
          <CardFooter>
            <div className="table-footer">
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowDaily((value) => !value)}
                aria-expanded={showDaily}
                aria-controls="daily-breakdown"
              >
                <CalendarDays data-icon="inline-start" aria-hidden="true" />
                {showDaily ? "Hide daily breakdown" : "View daily breakdown"}
              </Button>
              <span>
                {movements.length
                  ? `Showing ${Math.min(6, movements.length)} of ${movements.length} movements`
                  : "No movements yet"}
              </span>
            </div>
          </CardFooter>
        </Card>
        {showDaily ? (
          <DailyTable
            result={result}
            currency={settings.currency}
            onSelect={setSelectedDay}
          />
        ) : null}
      </div>
      <PrintReport
        workspace={workspace}
        result={result}
        isDemo={stored.isDemo}
        isPreview={!!preview}
      />
      {editor ? (
        <InvoiceEditor
          base={editor.base}
          invoice={editor.base.workspace.invoices.find(
            (invoice) => invoice.id === editor.invoiceId,
          )}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {day ? (
        <DayDetails
          day={day}
          currency={settings.currency}
          onClose={() => setSelectedDay(null)}
        />
      ) : null}
    </>
  );
}
