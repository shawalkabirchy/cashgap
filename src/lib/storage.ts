import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  CashGapError,
  forecast,
  validateWorkspace,
  type StoredWorkspace,
  type Workspace,
} from "./domain";
import { createSample } from "./sample";

interface CashGapDatabase extends DBSchema {
  workspace: { key: string; value: StoredWorkspace };
}

let connection: Promise<IDBPDatabase<CashGapDatabase>> | undefined;

export function storageError(error: unknown): CashGapError {
  if (error instanceof CashGapError) return error;
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return new CashGapError(
      "STORAGE_FULL",
      "Your browser storage is full. Your changes are not saved. Free some space or export your unsaved changes.",
    );
  return new CashGapError(
    "STORAGE_UNAVAILABLE",
    "Browser storage is unavailable. Your changes are not saved. Try allowing site storage, or export a backup.",
  );
}

async function database() {
  if (!connection)
    connection = openDB<CashGapDatabase>("cashgap", 1, {
      upgrade(db) {
        db.createObjectStore("workspace");
      },
      blocking() {
        void connection?.then((db) => db.close());
        connection = undefined;
      },
      terminated() {
        connection = undefined;
      },
    });
  try {
    return await connection;
  } catch (error) {
    connection = undefined;
    throw storageError(error);
  }
}

function validateStored(input: StoredWorkspace): StoredWorkspace {
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 1 ||
    typeof input.isDemo !== "boolean"
  )
    throw new CashGapError(
      "STORAGE_UNAVAILABLE",
      "The stored workspace format could not be read. The existing data has been preserved.",
    );
  return { ...input, workspace: validateWorkspace(input.workspace) };
}

export async function loadWorkspace(): Promise<StoredWorkspace> {
  const db = await database();
  const tx = db.transaction("workspace", "readwrite");
  try {
    const existing = await tx.store.get("current");
    const stored = existing
      ? validateStored(existing)
      : { revision: 1, isDemo: true, workspace: createSample() };
    if (!existing) await tx.store.put(stored, "current");
    await tx.done;
    return stored;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* A failed transaction may already be closed. */
    }
    await tx.done.catch(() => undefined);
    throw storageError(error);
  }
}

export async function commitWorkspace(
  workspace: Workspace,
  expectedRevision: number,
  isDemo: boolean,
  replace = false,
): Promise<StoredWorkspace> {
  const valid = validateWorkspace(workspace);
  forecast(valid);
  const db = await database();
  const tx = db.transaction("workspace", "readwrite");
  try {
    const current = await tx.store.get("current");
    if ((current?.revision ?? 0) !== expectedRevision)
      throw new CashGapError(
        "STALE_LOCAL_STATE",
        "Another tab changed this workspace. Copy or export your unsaved changes, then reload the saved workspace.",
      );
    if (
      !replace &&
      current &&
      (current.workspace.invoices.length ||
        current.workspace.expenses.length) &&
      current.workspace.settings.currency !== valid.settings.currency
    ) {
      throw new CashGapError(
        "VALIDATION_ERROR",
        "Currency is locked while this workspace contains financial records.",
      );
    }
    const next = { revision: expectedRevision + 1, workspace: valid, isDemo };
    if (!Number.isSafeInteger(next.revision))
      throw new CashGapError(
        "STORAGE_UNAVAILABLE",
        "The workspace revision cannot be advanced. Export a backup before continuing.",
      );
    await tx.store.put(next, "current");
    await tx.done;
    return next;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Preserve the previously committed transaction. */
    }
    await tx.done.catch(() => undefined);
    throw storageError(error);
  }
}
