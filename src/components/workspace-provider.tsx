"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CashGapError,
  type StoredWorkspace,
  type Workspace,
} from "@/lib/domain";
import { commitWorkspace, loadWorkspace, storageError } from "@/lib/storage";
import { downloadText, makeBackup } from "@/lib/transfers";
import { createSample } from "@/lib/sample";

type WorkspaceContextValue = {
  stored: StoredWorkspace | null;
  error: CashGapError | null;
  loading: boolean;
  saving: boolean;
  conflict: boolean;
  pending: Workspace | null;
  notice: string;
  commit: (
    workspace: Workspace,
    revision?: number,
    options?: { isDemo?: boolean; replace?: boolean },
  ) => Promise<void>;
  reload: () => Promise<void>;
  continueUnsaved: () => void;
  backup: (source: "saved" | "pending") => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<StoredWorkspace | null>(null);
  const [error, setError] = useState<CashGapError | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState<Workspace | null>(null);
  const [notice, setNotice] = useState("");
  const current = useRef<StoredWorkspace | null>(null);
  const writing = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const accept = useCallback((value: StoredWorkspace) => {
    current.current = value;
    setStored(value);
    setPending(null);
    setError(null);
    setConflict(false);
  }, []);

  useEffect(() => {
    let active = true;
    loadWorkspace()
      .then((value) => {
        if (active) accept(value);
      })
      .catch((cause) => {
        if (active) setError(storageError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accept]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const broadcast = new BroadcastChannel("cashgap-workspace");
    channel.current = broadcast;
    broadcast.onmessage = (event: MessageEvent<unknown>) => {
      if (
        typeof event.data === "number" &&
        current.current &&
        event.data !== current.current.revision
      ) {
        setConflict(true);
        setNotice(
          "Another tab saved changes. Reload before making your next save.",
        );
      }
    };
    return () => {
      broadcast.close();
      channel.current = null;
    };
  }, []);

  const commit = useCallback(
    async (
      workspace: Workspace,
      revision?: number,
      options?: { isDemo?: boolean; replace?: boolean },
    ) => {
      if (writing.current)
        throw new CashGapError(
          "BUSY",
          "A save is already in progress. Please wait.",
        );
      const previous = current.current;
      if (!previous)
        throw new CashGapError(
          "STORAGE_UNAVAILABLE",
          "Open a workspace before saving.",
        );
      writing.current = true;
      setSaving(true);
      try {
        const next = await commitWorkspace(
          workspace,
          revision ?? previous.revision,
          options?.isDemo ?? previous.isDemo,
          options?.replace ?? false,
        );
        accept(next);
        setNotice("Saved on this device.");
        channel.current?.postMessage(next.revision);
      } catch (cause) {
        const failure = storageError(cause);
        if (
          ["STORAGE_FULL", "STORAGE_UNAVAILABLE", "STALE_LOCAL_STATE"].includes(
            failure.code,
          )
        ) {
          setPending(workspace);
          setError(failure);
        }
        if (failure.code === "STALE_LOCAL_STATE") setConflict(true);
        throw failure;
      } finally {
        writing.current = false;
        setSaving(false);
      }
    },
    [accept],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      accept(await loadWorkspace());
      setNotice("Reloaded the saved workspace.");
    } catch (cause) {
      setError(storageError(cause));
    } finally {
      setLoading(false);
    }
  }, [accept]);

  const continueUnsaved = useCallback(() => {
    const value = { revision: 0, isDemo: true, workspace: createSample() };
    current.current = value;
    setStored(value);
    setNotice("Unsaved sample session. Browser storage has not been replaced.");
  }, []);

  useEffect(() => {
    if (!pending) return;
    const protectPending = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.onbeforeunload = protectPending;
    return () => {
      if (window.onbeforeunload === protectPending)
        window.onbeforeunload = null;
    };
  }, [pending]);

  const backup = useCallback(
    (source: "saved" | "pending") => {
      const workspace =
        source === "pending" ? pending : current.current?.workspace;
      if (!workspace) return;
      try {
        downloadText(
          makeBackup(workspace),
          source === "pending"
            ? "cashgap-unsaved-backup.json"
            : "cashgap-backup.json",
        );
        setNotice(
          source === "pending"
            ? "Backup of unsaved changes prepared."
            : "Backup prepared. Keep it somewhere safe.",
        );
      } catch (cause) {
        setNotice(
          cause instanceof Error
            ? cause.message
            : "The backup could not be prepared.",
        );
      }
    },
    [pending],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        stored,
        error,
        loading,
        saving,
        conflict,
        pending,
        notice,
        commit,
        reload,
        continueUnsaved,
        backup,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("CashGap components require WorkspaceProvider.");
  return context;
}
