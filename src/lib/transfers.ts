import Papa from "papaparse";
import { z } from "zod";
import {
  CashGapError,
  invoiceSchema,
  expenseSchema,
  parseMoney,
  validateWorkspace,
  workspaceSchema,
  type Workspace,
} from "./domain";

export const CSV_LIMIT = 1024 * 1024;
export const BACKUP_LIMIT = 10 * 1024 * 1024;
export const CSV_HEADERS = ["type", "label", "clientName", "amount", "date"];
const backupSchema = z.strictObject({
  appId: z.literal("P05"),
  formatVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  payload: workspaceSchema,
});

export function makeBackup(workspace: Workspace): string {
  return JSON.stringify(
    {
      appId: "P05",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      payload: validateWorkspace(workspace),
    },
    null,
    2,
  );
}

export function readBackup(text: string): Workspace {
  if (new TextEncoder().encode(text).byteLength > BACKUP_LIMIT)
    throw new CashGapError(
      "FILE_TOO_LARGE",
      "Backups must be no larger than 10 MiB.",
    );
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new CashGapError(
      "IMPORT_INVALID",
      "This file is not valid JSON. Choose a CashGap backup.",
    );
  }
  const result = backupSchema.safeParse(input);
  if (!result.success)
    throw new CashGapError(
      "IMPORT_INVALID",
      `Invalid CashGap v1 backup: ${result.error.issues[0]?.message ?? "check the file format"}`,
    );
  try {
    return validateWorkspace(result.data.payload);
  } catch (error) {
    throw new CashGapError(
      "IMPORT_INVALID",
      error instanceof Error
        ? error.message
        : "The backup contains invalid records.",
    );
  }
}

function duplicateKey(
  type: string,
  label: string,
  clientName: string,
  amount: number,
  date: string,
): string {
  return JSON.stringify([type, label.trim(), clientName.trim(), amount, date]);
}

export type CsvPreview = {
  workspace: Workspace | null;
  errors: { row: number; message: string }[];
  invoiceCount: number;
  expenseCount: number;
};

export function previewCsv(text: string, current: Workspace): CsvPreview {
  if (new TextEncoder().encode(text).byteLength > CSV_LIMIT)
    throw new CashGapError(
      "FILE_TOO_LARGE",
      "CSV files must be no larger than 1 MiB.",
    );
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: ",",
    dynamicTyping: false,
    skipEmptyLines: "greedy",
    preview: 501,
  });
  if (parsed.meta.fields?.join(",") !== CSV_HEADERS.join(","))
    throw new CashGapError(
      "IMPORT_INVALID",
      `Use exactly these CSV columns in order: ${CSV_HEADERS.join(",")}.`,
    );
  if (parsed.data.length > 500 || parsed.meta.truncated)
    throw new CashGapError(
      "IMPORT_INVALID",
      "Import no more than 500 rows at a time.",
    );
  if (!parsed.data.length)
    throw new CashGapError(
      "IMPORT_INVALID",
      "Add at least one data row to the CSV.",
    );
  const errors = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 2,
    message: error.message,
  }));
  const existing = new Set([
    ...current.invoices.map((invoice) =>
      duplicateKey(
        "invoice",
        invoice.label,
        invoice.clientName ?? "",
        invoice.amountMinor,
        invoice.expectedOn,
      ),
    ),
    ...current.expenses.map((expense) =>
      duplicateKey(
        "expense",
        expense.label,
        "",
        expense.amountMinor,
        expense.startOn,
      ),
    ),
  ]);
  const invoices = [...current.invoices];
  const expenses = [...current.expenses];
  let invoiceCount = 0;
  let expenseCount = 0;
  for (const [index, row] of parsed.data.entries()) {
    try {
      if (!CSV_HEADERS.every((column) => typeof row[column] === "string"))
        throw new Error(
          "Each row must contain all five CSV columns; optional clientName may be empty.",
        );
      if (!["invoice", "expense"].includes(row.type))
        throw new Error("Type must be invoice or expense.");
      if (row.type === "expense" && row.clientName.trim())
        throw new Error("Leave clientName empty for an expense.");
      const amountMinor = parseMoney(row.amount);
      const timestamp = new Date().toISOString();
      const common = {
        id: crypto.randomUUID(),
        label: row.label,
        amountMinor,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const key = duplicateKey(
        row.type,
        row.label,
        row.clientName,
        amountMinor,
        row.date,
      );
      if (existing.has(key))
        throw new Error(
          "This row duplicates a record in the workspace or file.",
        );
      if (row.type === "invoice") {
        const invoice = invoiceSchema.parse({
          ...common,
          ...(row.clientName.trim()
            ? { clientName: row.clientName.trim() }
            : {}),
          expectedOn: row.date,
          status: "expected",
        });
        invoices.push(invoice);
        invoiceCount++;
      } else {
        expenses.push(
          expenseSchema.parse({
            ...common,
            startOn: row.date,
            frequency: "once",
          }),
        );
        expenseCount++;
      }
      existing.add(key);
    } catch (error) {
      errors.push({
        row: index + 2,
        message:
          error instanceof z.ZodError
            ? error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("; ")
            : error instanceof Error
              ? error.message
              : "Invalid row.",
      });
    }
  }
  let workspace: Workspace | null = null;
  if (!errors.length) {
    try {
      workspace = validateWorkspace({ ...current, invoices, expenses });
    } catch (error) {
      errors.push({
        row: 0,
        message:
          error instanceof Error
            ? error.message
            : "The import exceeds workspace limits.",
      });
    }
  }
  return { workspace, errors, invoiceCount, expenseCount };
}

export function downloadText(
  contents: string,
  filename: string,
  type = "application/json",
): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
