import {
  addDays,
  localToday,
  type Expense,
  type Invoice,
  type Workspace,
} from "./domain";

export function createSample(startOn = localToday()): Workspace {
  const timestamp = `${startOn}T00:00:00.000Z`;
  const record = (index: number) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const invoice = (
    index: number,
    label: string,
    clientName: string,
    amountMinor: number,
    offset: number,
  ): Invoice => ({
    ...record(index),
    label,
    clientName,
    amountMinor,
    expectedOn: addDays(startOn, offset),
    status: "expected",
  });
  const expense = (
    index: number,
    label: string,
    amountMinor: number,
    offset: number,
    frequency: Expense["frequency"] = "once",
  ): Expense => ({
    ...record(index),
    label,
    amountMinor,
    startOn: addDays(startOn, offset),
    frequency,
  });
  return {
    settings: {
      currency: "USD",
      startOn,
      openingMinor: 1_250_000,
      reserveMinor: 300_000,
      horizonDays: 90,
    },
    invoices: [
      invoice(1, "Website redesign", "Juniper Co.", 850_000, 5),
      invoice(2, "Brand strategy workshop", "Oak & Pine", 620_000, 22),
      invoice(3, "Design retainer", "Ridgeway Studio", 480_000, 38),
      invoice(4, "Development milestone", "Juniper Co.", 800_000, 50),
      invoice(5, "Product discovery", "Bluebird Labs", 350_000, 65),
      invoice(6, "Design retainer renewal", "Ridgeway Studio", 480_000, 80),
    ],
    expenses: [
      expense(101, "Software & subscriptions", 24_000, 0, "monthly"),
      expense(102, "Studio & utilities", 95_000, 2, "monthly"),
      expense(103, "Team payroll", 1_200_000, 10),
      expense(104, "Contractor: development support", 450_000, 35),
      expense(105, "Team payroll", 900_000, 55),
    ],
  };
}
