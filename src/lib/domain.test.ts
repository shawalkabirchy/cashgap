import { describe, expect, it } from "vitest";
import {
  addDays,
  expenseDates,
  forecast,
  isCalendarDate,
  MAX_AMOUNT,
  moneyInput,
  parseMoney,
  shiftInvoices,
  validateWorkspace,
  type Expense,
  type Workspace,
} from "./domain";
import { createSample } from "./sample";

const stamp = "2026-01-01T00:00:00.000Z";
function fixture(): Workspace {
  return {
    settings: {
      currency: "USD",
      startOn: "2026-01-01",
      openingMinor: 100_000,
      reserveMinor: 30_000,
      horizonDays: 30,
    },
    invoices: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        label: "Client payment",
        amountMinor: 200_000,
        expectedOn: "2026-01-10",
        status: "expected",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    expenses: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        label: "Payroll",
        amountMinor: 120_000,
        frequency: "once",
        startOn: "2026-01-03",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
  };
}

describe("exact money and calendar dates", () => {
  it("parses cents without floating-point rounding", () => {
    expect(parseMoney("0.29")).toBe(29);
    expect(parseMoney("100.1")).toBe(10010);
    expect(parseMoney("-0.01", true)).toBe(-1);
    expect(parseMoney("10000000.00")).toBe(MAX_AMOUNT);
    expect(moneyInput(-12345)).toBe("-123.45");
  });
  it.each(["1.001", "1e3", "1,000", "NaN", "", "10000000.01", "-1.00"])(
    "rejects invalid amount %s",
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  it("validates real dates and leap years", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarDate("0000-01-01")).toBe(false);
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(() => addDays("9999-12-31", 1)).toThrow();
  });
});

describe("CashGap forecast acceptance", () => {
  it("P05-A1/A2: projects daily balances, reserve breaches and initial top-up", () => {
    const result = forecast(fixture());
    expect(result.lowestMinor).toBe(-20_000);
    expect(result.lowestOn).toBe("2026-01-03");
    expect(result.firstBreachOn).toBe("2026-01-03");
    expect(result.closingMinor).toBe(180_000);
    expect(result.topUpMinor).toBe(50_000);
    expect(
      result.days[2].openingMinor +
        result.days[2].incomingMinor -
        result.days[2].outgoingMinor,
    ).toBe(result.days[2].closingMinor);
    expect(result.days[2].recordIds).toEqual([fixture().expenses[0].id]);
  });
  it("treats equality with the reserve as safe and preserves a negative opening", () => {
    const workspace = fixture();
    workspace.invoices = [];
    workspace.expenses = [];
    workspace.settings.openingMinor = 30_000;
    expect(forecast(workspace).dangerDays).toBe(0);
    workspace.settings.openingMinor = -50;
    expect(forecast(workspace).lowestMinor).toBe(-50);
  });
  it("nets same-day events and includes both horizon boundaries", () => {
    const workspace = fixture();
    workspace.invoices[0].expectedOn = "2026-01-01";
    workspace.expenses[0].startOn = "2026-01-01";
    expect(forecast(workspace).days[0].closingMinor).toBe(180_000);
    workspace.invoices[0].expectedOn = "2026-01-30";
    expect(forecast(workspace).days[29].incomingMinor).toBe(200_000);
    workspace.invoices[0].expectedOn = "2026-01-31";
    expect(forecast(workspace).closingMinor).toBe(-20_000);
  });
  it("P05-A3: keeps the original monthly anchor and exclusive end", () => {
    const expense: Expense = {
      ...fixture().expenses[0],
      frequency: "monthly",
      startOn: "2026-01-31",
    };
    expect(expenseDates(expense, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expense.endOn = "2026-03-31";
    expect(expenseDates(expense, "2026-02-01", "2026-04-30")).toEqual([
      "2026-02-28",
    ]);
    expense.startOn = "2024-01-31";
    delete expense.endOn;
    expect(expenseDates(expense, "2024-02-01", "2024-03-31")).toEqual([
      "2024-02-29",
      "2024-03-31",
    ]);
  });
  it("P05-A4: moves actual receipts without double counting", () => {
    const workspace = fixture();
    workspace.invoices[0] = {
      ...workspace.invoices[0],
      status: "received",
      receivedOn: "2026-01-15",
    };
    const result = forecast(workspace);
    expect(result.days[9].incomingMinor).toBe(0);
    expect(result.days[14].incomingMinor).toBe(200_000);
    expect(result.days.reduce((sum, day) => sum + day.incomingMinor, 0)).toBe(
      200_000,
    );
    workspace.invoices[0].receivedOn = "2025-12-31";
    expect(forecast(workspace).closingMinor).toBe(-20_000);
  });
  it("excludes cancelled and overdue receipts and rejects future actual receipts", () => {
    const workspace = fixture();
    workspace.invoices[0].expectedOn = "2025-12-31";
    expect(forecast(workspace).overdue).toHaveLength(1);
    expect(forecast(workspace).closingMinor).toBe(-20_000);
    workspace.invoices[0].status = "cancelled";
    expect(forecast(workspace).overdue).toHaveLength(0);
    workspace.invoices[0] = {
      ...workspace.invoices[0],
      status: "received",
      receivedOn: "2026-01-15",
    };
    expect(() => validateWorkspace(workspace, "2026-01-14")).toThrow("future");
  });
  it("P05-A5: creates an immutable scenario and validates selected invoices", () => {
    const workspace = fixture();
    const original = structuredClone(workspace);
    const shifted = shiftInvoices(workspace, [workspace.invoices[0].id], 14);
    expect(shifted.invoices[0].expectedOn).toBe("2026-01-24");
    expect(workspace).toEqual(original);
    expect(() => shiftInvoices(workspace, [], 14)).toThrow();
    expect(() =>
      shiftInvoices(workspace, [workspace.invoices[0].id], 366),
    ).toThrow();
    workspace.invoices[0].status = "cancelled";
    expect(() =>
      shiftInvoices(workspace, [workspace.invoices[0].id], 14),
    ).toThrow();
  });
  it("rejects invalid enums, duplicate IDs and over-limit amounts", () => {
    const workspace = fixture();
    expect(() => validateWorkspace({ ...workspace, extra: true })).toThrow();
    workspace.expenses[0].id = workspace.invoices[0].id;
    expect(() => validateWorkspace(workspace)).toThrow("unique");
    workspace.expenses = [];
    workspace.invoices[0].amountMinor = MAX_AMOUNT + 1;
    expect(() => validateWorkspace(workspace)).toThrow();
  });
  it("sample baseline is safe and a 14-day Juniper delay creates a cash gap", () => {
    const sample = createSample("2026-10-25");
    validateWorkspace(sample, "2026-10-25");
    expect(forecast(sample).topUpMinor).toBe(0);
    expect(
      forecast(shiftInvoices(sample, [sample.invoices[0].id], 14)).topUpMinor,
    ).toBeGreaterThan(0);
  });
  it("processes the maximum supported records without losing integer precision", () => {
    const workspace = fixture();
    workspace.settings.horizonDays = 365;
    workspace.invoices = Array.from({ length: 500 }, (_, index) => ({
      ...fixture().invoices[0],
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      amountMinor: MAX_AMOUNT,
    }));
    workspace.expenses = [
      ...Array.from({ length: 500 }, (_, index) => ({
        ...fixture().expenses[0],
        id: `00000001-0000-4000-8000-${String(index).padStart(12, "0")}`,
        amountMinor: MAX_AMOUNT,
      })),
      ...Array.from({ length: 50 }, (_, index) => ({
        ...fixture().expenses[0],
        id: `00000002-0000-4000-8000-${String(index).padStart(12, "0")}`,
        amountMinor: MAX_AMOUNT,
        frequency: "monthly" as const,
      })),
    ];
    validateWorkspace(workspace);
    const start = performance.now();
    const result = forecast(workspace);
    const duration = performance.now() - start;
    console.info(
      `Maximum dataset (500 invoices, 500 expenses, 50 monthly rules, 365 days): ${duration.toFixed(2)} ms`,
    );
    expect(result.days).toHaveLength(365);
    expect(Number.isSafeInteger(result.closingMinor)).toBe(true);
    expect(duration).toBeLessThan(200);
  });
});
