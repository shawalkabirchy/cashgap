import { z } from "zod";

export const MAX_AMOUNT = 1_000_000_000;
export const HORIZONS = [30, 90, 180, 365] as const;
export const DAY_MS = 86_400_000;

export class CashGapError extends Error {
  constructor(
    public code: string,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "CashGapError";
  }
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const time = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value
  );
}

export function addDays(value: string, days: number): string {
  if (!isCalendarDate(value) || !Number.isInteger(days))
    throw new CashGapError(
      "VALIDATION_ERROR",
      "Enter a valid calendar date and whole number of days.",
    );
  const time = new Date(
    new Date(`${value}T00:00:00.000Z`).getTime() + days * DAY_MS,
  );
  const date = Number.isFinite(time.getTime())
    ? time.toISOString().slice(0, 10)
    : "";
  if (!isCalendarDate(date))
    throw new CashGapError(
      "VALIDATION_ERROR",
      "The resulting date must be between years 0001 and 9999.",
    );
  return date;
}

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function parseMoney(input: string, allowNegative = false): number {
  const value = input.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match || value.length > 30)
    throw new CashGapError(
      "VALIDATION_ERROR",
      "Enter an amount with up to two decimal places, without commas or currency symbols.",
    );
  let minor = BigInt(match[2]) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  if (match[1]) minor = -minor;
  if (
    (!allowNegative && minor < 0n) ||
    minor < -BigInt(MAX_AMOUNT) ||
    minor > BigInt(MAX_AMOUNT)
  ) {
    throw new CashGapError(
      "VALIDATION_ERROR",
      `Amount must be ${allowNegative ? "between −10,000,000.00 and" : "between 0.00 and"} 10,000,000.00.`,
    );
  }
  return Number(minor);
}

export function moneyInput(minor: number): string {
  return `${minor < 0 ? "-" : ""}${Math.trunc(Math.abs(minor) / 100)}.${String(Math.abs(minor) % 100).padStart(2, "0")}`;
}

const moneyFormats = Object.fromEntries(
  ["USD", "BDT"].map((currency) => [
    currency,
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  ]),
);
export function formatMoney(minor: number, currency: "USD" | "BDT"): string {
  return moneyFormats[currency].format(minor / 100);
}

const dateFormats = [false, true].map(
  (full) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(full ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }),
);
export function formatDate(value: string, full = false): string {
  return dateFormats[full ? 1 : 0].format(new Date(`${value}T00:00:00.000Z`));
}

const dateSchema = z
  .string()
  .refine(isCalendarDate, "Enter a real date in YYYY-MM-DD format.");
const amountSchema = z.number().int().min(1).max(MAX_AMOUNT);
const labelSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(80, "Use no more than 80 characters.");
const timestamps = {
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

export const settingsSchema = z
  .strictObject({
    currency: z.enum(["USD", "BDT"]),
    startOn: dateSchema,
    openingMinor: z.number().int().min(-MAX_AMOUNT).max(MAX_AMOUNT),
    reserveMinor: z.number().int().min(0).max(MAX_AMOUNT),
    horizonDays: z.union([
      z.literal(30),
      z.literal(90),
      z.literal(180),
      z.literal(365),
    ]),
  })
  .superRefine((settings, ctx) => {
    if (!isCalendarDate(settings.startOn)) return;
    try {
      addDays(settings.startOn, settings.horizonDays - 1);
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["startOn"],
        message: "The full forecast must fit within years 0001–9999.",
      });
    }
  });

export const invoiceSchema = z
  .strictObject({
    ...timestamps,
    label: labelSchema,
    clientName: labelSchema.optional(),
    amountMinor: amountSchema,
    expectedOn: dateSchema,
    status: z.enum(["expected", "received", "cancelled"]),
    receivedOn: dateSchema.optional(),
  })
  .superRefine((invoice, ctx) => {
    if (invoice.status === "received" && !invoice.receivedOn)
      ctx.addIssue({
        code: "custom",
        path: ["receivedOn"],
        message: "Enter the actual receipt date.",
      });
    if (invoice.status !== "received" && invoice.receivedOn !== undefined)
      ctx.addIssue({
        code: "custom",
        path: ["receivedOn"],
        message: "Only received invoices have an actual receipt date.",
      });
  });

export const expenseSchema = z
  .strictObject({
    ...timestamps,
    label: labelSchema,
    amountMinor: amountSchema,
    frequency: z.enum(["once", "monthly"]),
    startOn: dateSchema,
    endOn: dateSchema.optional(),
  })
  .superRefine((expense, ctx) => {
    if (
      expense.endOn &&
      (expense.frequency !== "monthly" || expense.endOn <= expense.startOn)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endOn"],
        message:
          "A monthly rule's end date must be later than its start date; the end date is excluded.",
      });
    }
  });

export const workspaceSchema = z
  .strictObject({
    settings: settingsSchema,
    invoices: z
      .array(invoiceSchema)
      .max(500, "A workspace supports up to 500 invoices."),
    expenses: z.array(expenseSchema).max(550),
  })
  .superRefine((workspace, ctx) => {
    const ids = new Set<string>();
    for (const record of [...workspace.invoices, ...workspace.expenses]) {
      if (ids.has(record.id))
        ctx.addIssue({ code: "custom", message: "Record IDs must be unique." });
      ids.add(record.id);
    }
    if (
      workspace.expenses.filter((expense) => expense.frequency === "once")
        .length > 500
    )
      ctx.addIssue({
        code: "custom",
        path: ["expenses"],
        message: "Use no more than 500 one-time expenses.",
      });
    if (
      workspace.expenses.filter((expense) => expense.frequency === "monthly")
        .length > 50
    )
      ctx.addIssue({
        code: "custom",
        path: ["expenses"],
        message: "Use no more than 50 monthly rules.",
      });
  });

export type PlanSettings = z.infer<typeof settingsSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type StoredWorkspace = {
  revision: number;
  isDemo: boolean;
  workspace: Workspace;
};
export type CashEvent = {
  id: string;
  label: string;
  clientName?: string;
  kind: "invoice" | "expense";
  amountMinor: number;
};
export type DayBalance = {
  date: string;
  openingMinor: number;
  incomingMinor: number;
  outgoingMinor: number;
  closingMinor: number;
  belowReserve: boolean;
  recordIds: string[];
  events: CashEvent[];
};
export type Forecast = {
  days: DayBalance[];
  overdue: Invoice[];
  lowestMinor: number;
  lowestOn: string;
  closingMinor: number;
  firstBreachOn: string | null;
  topUpMinor: number;
  dangerDays: number;
};

export function validationError(error: z.ZodError): CashGapError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues)
    fields[issue.path.join(".")] ??= issue.message;
  return new CashGapError(
    "VALIDATION_ERROR",
    error.issues[0]?.message ?? "Check the entered values.",
    fields,
  );
}

export function validateWorkspace(
  input: unknown,
  today = localToday(),
): Workspace {
  const result = workspaceSchema.safeParse(input);
  if (!result.success) throw validationError(result.error);
  const future = result.data.invoices.findIndex(
    (invoice) => invoice.status === "received" && invoice.receivedOn! > today,
  );
  if (future >= 0)
    throw new CashGapError(
      "VALIDATION_ERROR",
      "An actual receipt date cannot be in the future.",
      { [`invoices.${future}.receivedOn`]: "Choose today or an earlier date." },
    );
  return result.data;
}

export function expenseDates(
  expense: Expense,
  start: string,
  end: string,
): string[] {
  if (expense.frequency === "once")
    return expense.startOn >= start && expense.startOn <= end
      ? [expense.startOn]
      : [];
  const [year, month, anchor] = expense.startOn.split("-").map(Number);
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const dates: string[] = [];
  for (
    let index = Math.max(
      year * 12 + month - 1,
      startYear * 12 + startMonth - 1,
    );
    index <= endYear * 12 + endMonth - 1;
    index++
  ) {
    const currentYear = Math.floor(index / 12);
    const currentMonth = index % 12;
    const lastDay = new Date(0);
    lastDay.setUTCFullYear(currentYear, currentMonth + 1, 0);
    const date = `${String(currentYear).padStart(4, "0")}-${String(currentMonth + 1).padStart(2, "0")}-${String(Math.min(anchor, lastDay.getUTCDate())).padStart(2, "0")}`;
    if (
      date >= start &&
      date >= expense.startOn &&
      date <= end &&
      (!expense.endOn || date < expense.endOn)
    )
      dates.push(date);
  }
  return dates;
}

export function forecast(workspace: Workspace): Forecast {
  const { settings, invoices, expenses } = workspace;
  const end = addDays(settings.startOn, settings.horizonDays - 1);
  const events = new Map<string, CashEvent[]>();
  const put = (date: string, event: CashEvent) => {
    if (date < settings.startOn || date > end) return;
    const day = events.get(date) ?? [];
    day.push(event);
    events.set(date, day);
  };
  const overdue: Invoice[] = [];
  for (const invoice of invoices) {
    if (invoice.status === "cancelled") continue;
    if (
      invoice.status === "expected" &&
      invoice.expectedOn < settings.startOn
    ) {
      overdue.push(invoice);
      continue;
    }
    put(
      invoice.status === "received" ? invoice.receivedOn! : invoice.expectedOn,
      {
        id: invoice.id,
        label: invoice.label,
        clientName: invoice.clientName,
        kind: "invoice",
        amountMinor: invoice.amountMinor,
      },
    );
  }
  for (const expense of expenses)
    for (const date of expenseDates(expense, settings.startOn, end)) {
      put(date, {
        id: expense.id,
        label: expense.label,
        kind: "expense",
        amountMinor: expense.amountMinor,
      });
    }
  const days: DayBalance[] = [];
  let balance = settings.openingMinor;
  let lowestMinor = Infinity;
  let lowestOn = settings.startOn;
  let firstBreachOn: string | null = null;
  let dangerDays = 0;
  for (let offset = 0; offset < settings.horizonDays; offset++) {
    const date = addDays(settings.startOn, offset);
    const contributing = events.get(date) ?? [];
    let incomingMinor = 0;
    let outgoingMinor = 0;
    for (const event of contributing) {
      if (event.kind === "invoice") incomingMinor += event.amountMinor;
      else outgoingMinor += event.amountMinor;
    }
    const closingMinor = balance + incomingMinor - outgoingMinor;
    if (
      ![incomingMinor, outgoingMinor, closingMinor].every(Number.isSafeInteger)
    )
      throw new CashGapError(
        "VALIDATION_ERROR",
        "The calculated total is too large to represent safely.",
      );
    const belowReserve = closingMinor < settings.reserveMinor;
    if (belowReserve) {
      firstBreachOn ??= date;
      dangerDays++;
    }
    if (closingMinor < lowestMinor) {
      lowestMinor = closingMinor;
      lowestOn = date;
    }
    days.push({
      date,
      openingMinor: balance,
      incomingMinor,
      outgoingMinor,
      closingMinor,
      belowReserve,
      recordIds: contributing.map((event) => event.id),
      events: contributing,
    });
    balance = closingMinor;
  }
  const topUpMinor = Math.max(0, settings.reserveMinor - lowestMinor);
  if (!Number.isSafeInteger(topUpMinor))
    throw new CashGapError(
      "VALIDATION_ERROR",
      "The required top-up is too large to represent safely.",
    );
  return {
    days,
    overdue,
    lowestMinor,
    lowestOn,
    closingMinor: balance,
    firstBreachOn,
    topUpMinor,
    dangerDays,
  };
}

export function shiftInvoices(
  workspace: Workspace,
  ids: string[],
  days: number,
): Workspace {
  if (
    !Number.isInteger(days) ||
    days < -365 ||
    days > 365 ||
    !ids.length ||
    new Set(ids).size !== ids.length
  )
    throw new CashGapError(
      "VALIDATION_ERROR",
      "Select expected invoices and a whole-day shift between −365 and +365.",
    );
  const selected = new Set(ids);
  if (
    workspace.invoices.filter(
      (invoice) => selected.has(invoice.id) && invoice.status === "expected",
    ).length !== selected.size
  )
    throw new CashGapError(
      "VALIDATION_ERROR",
      "Only expected invoices can be moved in a scenario.",
    );
  return {
    ...workspace,
    invoices: workspace.invoices.map((invoice) =>
      selected.has(invoice.id)
        ? { ...invoice, expectedOn: addDays(invoice.expectedOn, days) }
        : invoice,
    ),
  };
}
