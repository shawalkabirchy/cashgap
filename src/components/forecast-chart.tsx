"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
  baseline: { label: "Current plan", color: "#7b8982" },
};

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
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(10_000, (max - min) * 0.08);
  return (
    <ChartContainer
      config={config}
      className="forecast-chart"
      role="group"
      aria-label="Daily closing cash balance. Use arrow keys for values, or select a day in the daily breakdown table."
    >
      <ComposedChart
        data={data}
        margin={{ left: 0, right: 10, top: 20, bottom: 0 }}
        accessibilityLayer
        onClick={(state) => {
          if (typeof state.activeLabel === "string")
            onSelect(state.activeLabel);
        }}
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          minTickGap={40}
          tickFormatter={(date: string) => formatDate(date)}
        />
        <YAxis
          domain={[min < 0 ? min - padding : 0, max + padding]}
          tickLine={false}
          axisLine={false}
          width={66}
          tickMargin={10}
          tickFormatter={(value: number) =>
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              style: "currency",
              currency: settings.currency,
              maximumFractionDigits: 0,
            }).format(value / 100)
          }
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
          fillOpacity={0.7}
          isAnimationActive={false}
        />
        {baseline ? (
          <Line
            dataKey="baseline"
            type="stepAfter"
            stroke="#7b8982"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
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
            fontSize: 11,
          }}
        />
        {min < 0 ? (
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
