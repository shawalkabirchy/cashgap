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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  return (
    <>
      <div className="screen-only">
        <header className="page-header">
          <div>
            <h1>Your cash, a clearer picture.</h1>
            <p>
              See what’s coming in, what’s going out, and where the gaps are.
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
          <Alert variant="destructive" className="mb-5">
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
            <dd>
              <span data-testid="metric-lowest">
                {money(result.lowestMinor)}
              </span>
              <small>{formatDate(result.lowestOn, true)}</small>
            </dd>
          </div>
          <div className="metric">
            <dt>First reserve breach</dt>
            <dd className="metric-text">
              <span data-testid="metric-breach">
                {result.firstBreachOn
                  ? formatDate(result.firstBreachOn, true)
                  : "None in this forecast"}
              </span>
              <small>
                {result.dangerDays
                  ? `${result.dangerDays} day${result.dangerDays === 1 ? "" : "s"} below reserve`
                  : "A little breathing room"}
              </small>
            </dd>
          </div>
          <div className="metric">
            <dt>Closing balance</dt>
            <dd>
              <span data-testid="metric-closing">
                {money(result.closingMinor)}
              </span>
              <small>{formatDate(end, true)}</small>
            </dd>
          </div>
        </dl>
        {result.overdue.length ? (
          <Alert className="mb-5">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>
              Overdue & unscheduled · {result.overdue.length}
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
          <Card>
            <CardHeader>
              <div className="chart-header">
                <div>
                  <CardTitle>
                    <h2 className="chart-title">Cash flow forecast</h2>
                  </CardTitle>
                  <p className="chart-subtitle">
                    {formatDate(settings.startOn, true)} –{" "}
                    {formatDate(end, true)} · {settings.currency}
                  </p>
                </div>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  size="sm"
                  value={String(settings.horizonDays)}
                  aria-label="Forecast horizon"
                  disabled={saving || !!preview}
                  onValueChange={async (value) => {
                    if (!value) return;
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
                >
                  {HORIZONS.map((days) => (
                    <ToggleGroupItem
                      key={days}
                      value={String(days)}
                      aria-label={`${days} days`}
                    >
                      {days} days
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent>
              <ForecastChart
                result={result}
                baseline={preview ? baseline : undefined}
                settings={settings}
                onSelect={setSelectedDay}
              />
              <div className="chart-key">
                <span>
                  <span className="legend-dot" />
                  {preview ? "Scenario preview" : "Projected closing balance"}
                </span>
                {preview ? (
                  <span>
                    <span className="legend-dot legend-baseline" />
                    Current plan
                  </span>
                ) : null}
                <span>Daily totals · select a day to explore</span>
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
        <Card>
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
                    <TableHead>Type</TableHead>
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
                          {formatDate(event.date, true)}
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
                      </TableCell>
                      <TableCell>
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
                  <EmptyTitle>A clean slate</EmptyTitle>
                  <EmptyDescription>
                    Add your expected client receipts and scheduled expenses to
                    see them here.
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
                  : "Every movement starts with a plan"}
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
