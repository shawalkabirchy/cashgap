"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  formatDate,
  formatMoney,
  type Forecast,
  type PlanSettings,
} from "@/lib/domain";

const config = {
  closingMinor: { label: "Projected balance", color: "var(--primary)" },
  baseline: { label: "Current plan", color: "var(--chart-baseline)" },
};

/** A round step (1, 2, 2.5 or 5 × 10ⁿ minor units) for about `count` intervals. */
function niceStep(range: number, count = 5) {
  const raw = Math.max(range, 1) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function niceScale(min: number, max: number) {
  const step = niceStep(max - min);
  const low = min < 0 ? Math.floor(min / step) * step : 0;
  const high = Math.ceil((max + step * 0.15) / step) * step;
  const ticks: number[] = [];
  for (let value = low; value <= high + step / 2; value += step)
    ticks.push(Math.round(value));
  return { low, high, ticks };
}

export default function ForecastChart({
  result,
  baseline,
  settings,
  onSelect,
}: {
  result: Forecast;
  baseline?: Forecast;
  settings: PlanSettings;
  onSelect: (date: string) => void;
}) {
  const data = result.days.map((day, index) => ({
    date: day.date,
    closingMinor: day.closingMinor,
    ...(baseline ? { baseline: baseline.days[index]?.closingMinor } : {}),
  }));
  const values = [
    ...result.days.map((day) => day.closingMinor),
    ...(baseline?.days.map((day) => day.closingMinor) ?? []),
    settings.reserveMinor,
    0,
  ];
  const { low, high, ticks } = niceScale(Math.min(...values), Math.max(...values));
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    style: "currency",
    currency: settings.currency,
    maximumFractionDigits: 1,
  });
  return (
    <ChartContainer
      config={config}
      className="forecast-chart"
      role="group"
      aria-label="Daily closing cash balance. Use arrow keys for values, or select a day in the daily breakdown table."
    >
      <ComposedChart
        data={data}
        margin={{ left: 0, right: 8, top: 16, bottom: 0 }}
        accessibilityLayer
        onClick={(state) => {
          if (typeof state.activeLabel === "string")
            onSelect(state.activeLabel);
        }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        {settings.reserveMinor > low ? (
          <ReferenceArea
            y1={low}
            y2={settings.reserveMinor}
            fill="var(--danger-zone)"
            fillOpacity={0.45}
            stroke="none"
            ifOverflow="hidden"
          />
        ) : null}
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          minTickGap={48}
          fontSize={13}
          tickFormatter={(date: string) => formatDate(date)}
        />
        <YAxis
          domain={[low, high]}
          ticks={ticks}
          interval={0}
          tickLine={false}
          axisLine={false}
          width={64}
          tickMargin={8}
          fontSize={13}
          tickFormatter={(value: number) => compact.format(value / 100)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) =>
                typeof label === "string" ? formatDate(label, true) : label
              }
              formatter={(value, name) => (
                <span className="flex w-full items-center justify-between gap-4">
                  <span>
                    {name === "baseline" ? "Current plan" : "Projected balance"}
                  </span>
                  <strong className="money">
                    {formatMoney(Number(value), settings.currency)}
                  </strong>
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="closingMinor"
          type="stepAfter"
          stroke="var(--primary)"
          strokeWidth={2.2}
          fill="var(--secondary)"
          fillOpacity={0.6}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
        />
        {baseline ? (
          <Line
            dataKey="baseline"
            type="stepAfter"
            stroke="var(--chart-baseline)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        ) : null}
        <ReferenceLine
          y={settings.reserveMinor}
          stroke="var(--warning)"
          strokeDasharray="4 4"
          label={{
            value: `Reserve ${formatMoney(settings.reserveMinor, settings.currency)}`,
            position: "insideTopRight",
            fill: "var(--warning)",
            fontSize: 13,
          }}
        />
        {low < 0 ? (
          <ReferenceLine
            y={0}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}
