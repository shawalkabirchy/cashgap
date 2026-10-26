import { describe, expect, it } from "vitest";
import { forecast, type Workspace } from "./domain";
import { createSample } from "./sample";
import { makeBackup, previewCsv, readBackup } from "./transfers";

const sample = () => createSample("2026-01-01");
const empty = (): Workspace => ({ ...sample(), invoices: [], expenses: [] });
const header = "type,label,clientName,amount,date\n";

describe("atomic file contracts", () => {
  it("P05-A6: JSON round trip preserves balances and recurrence", () => {
    const workspace = sample();
    const restored = readBackup(makeBackup(workspace));
    expect(restored).toEqual(workspace);
    expect(forecast(restored)).toEqual(forecast(workspace));
  });
  it("rejects invalid JSON, foreign apps, unsupported versions and duplicate identifiers", () => {
    expect(() => readBackup("{")).toThrow("JSON");
    const backup = JSON.parse(makeBackup(sample()));
    expect(() =>
      readBackup(JSON.stringify({ ...backup, appId: "P01" })),
    ).toThrow();
    expect(() =>
      readBackup(JSON.stringify({ ...backup, formatVersion: 2 })),
    ).toThrow();
    backup.payload.expenses[0].id = backup.payload.invoices[0].id;
    expect(() => readBackup(JSON.stringify(backup))).toThrow();
  });
  it("parses quoted CSV fields and exact decimal money", () => {
    const preview = previewCsv(
      header +
        'invoice,"Workshop, discovery","Oak ""&"" Pine",0.29,2026-01-02\nexpense,Software,,24.00,2026-01-03',
      empty(),
    );
    expect(preview.errors).toEqual([]);
    expect(preview.invoiceCount).toBe(1);
    expect(preview.expenseCount).toBe(1);
    expect(preview.workspace!.invoices[0].clientName).toBe('Oak "&" Pine');
    expect(preview.workspace!.invoices[0].amountMinor).toBe(29);
  });
  it("one bad row prevents the entire candidate workspace", () => {
    const workspace = empty();
    const original = structuredClone(workspace);
    const result = previewCsv(
      header +
        "invoice,Valid,,1.00,2026-01-02\nexpense,Invalid,,1.999,2026-01-03",
      workspace,
    );
    expect(result.workspace).toBeNull();
    expect(result.errors[0].row).toBe(3);
    expect(workspace).toEqual(original);
  });
  it("rejects duplicate rows and existing normalized records", () => {
    const row = "invoice,Website redesign,Juniper Co.,8500,2026-01-06";
    expect(previewCsv(header + row, sample()).errors[0].message).toContain(
      "duplicates",
    );
    expect(previewCsv(header + row + "\n" + row, empty()).workspace).toBeNull();
    expect(
      previewCsv(
        header + "invoice, Website redesign ,Juniper Co.,8500,2026-01-06",
        sample(),
      ).workspace,
    ).toBeNull();
  });
  it("rejects invalid dates, expense clients, unexpected headers and enum values", () => {
    expect(
      previewCsv(header + "invoice,Invalid,,1.00,2026-02-29", empty())
        .workspace,
    ).toBeNull();
    expect(
      previewCsv(header + "expense,Rent,Client,1.00,2026-01-01", empty())
        .workspace,
    ).toBeNull();
    expect(
      previewCsv(header + "payment,Unknown,,1.00,2026-01-01", empty())
        .workspace,
    ).toBeNull();
    expect(() =>
      previewCsv("type,label,amount,date\ninvoice,x,1,2026-01-01", empty()),
    ).toThrow("columns");
    const missing = previewCsv(header + "invoice,Missing columns", empty());
    expect(missing.workspace).toBeNull();
    expect(
      missing.errors.some((error) =>
        error.message.includes("all five CSV columns"),
      ),
    ).toBe(true);
  });
  it("enforces file, row, and final workspace limits", () => {
    expect(() => previewCsv("x".repeat(1024 * 1024 + 1), empty())).toThrow(
      "1 MiB",
    );
    expect(() => readBackup("x".repeat(10 * 1024 * 1024 + 1))).toThrow(
      "10 MiB",
    );
    const rows = Array.from(
      { length: 501 },
      (_, index) => `invoice,Row ${index},,1.00,2026-01-01`,
    ).join("\n");
    expect(() => previewCsv(header + rows, empty())).toThrow("500 rows");
    const workspace = sample();
    workspace.invoices = Array.from({ length: 500 }, (_, index) => ({
      ...workspace.invoices[0],
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      label: `Invoice ${index}`,
    }));
    expect(
      previewCsv(header + "invoice,New,,1.00,2026-01-02", workspace).workspace,
    ).toBeNull();
  });
});
