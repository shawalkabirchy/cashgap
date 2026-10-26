"use client";

import { useState } from "react";
import { CashGapError, parseMoney } from "@/lib/domain";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoaderCircle, TriangleAlert } from "lucide-react";

export function TextField({
  label,
  error,
  hint,
  id,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: string;
  id: string;
}) {
  return (
    <Field data-invalid={!!error} data-disabled={props.disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={
          [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...props}
      />
      {hint ? (
        <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}

export function amountField(
  value: string,
  field: string,
  allowNegative = false,
): number {
  try {
    return parseMoney(value, allowNegative);
  } catch (cause) {
    throw new CashGapError(
      "VALIDATION_ERROR",
      cause instanceof Error ? cause.message : "Invalid amount.",
      { [field]: cause instanceof Error ? cause.message : "Invalid amount." },
    );
  }
}

export function getFormErrors(error: unknown): {
  message: string;
  fields: Record<string, string>;
} {
  const fields: Record<string, string> = {};
  if (error instanceof z.ZodError) {
    for (const issue of error.issues)
      fields[String(issue.path.at(-1) ?? "form")] ??= issue.message;
    return {
      message: "Check the highlighted fields. Nothing has been saved.",
      fields,
    };
  }
  if (error instanceof CashGapError)
    for (const [key, value] of Object.entries(error.fieldErrors))
      fields[key.split(".").at(-1)!] ??= value;
  return {
    message:
      error instanceof Error
        ? error.message
        : "Could not save. Please try again.",
    fields,
  };
}

export function FormFailure({ message }: { message?: string }) {
  return message ? (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Not saved</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
}

export function SaveButton({
  busy,
  children = "Save changes",
}: {
  busy: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Button type="submit" disabled={busy} size="lg">
      {busy ? (
        <LoaderCircle
          data-icon="inline-start"
          className="animate-spin"
          aria-hidden="true"
        />
      ) : null}
      {busy ? "Saving…" : children}
    </Button>
  );
}

export function Confirmation({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <FormFailure message={failure} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            Keep current data
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async (event) => {
              event.preventDefault();
              setBusy(true);
              setFailure("");
              try {
                await onConfirm();
                onClose();
              } catch (error) {
                setFailure(getFormErrors(error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
