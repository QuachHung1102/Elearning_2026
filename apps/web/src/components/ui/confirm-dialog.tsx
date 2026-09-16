"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "./button";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  trigger,
  onConfirm,
  busy,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  trigger: ReactNode;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <span onClick={() => dialog.current?.showModal()}>{trigger}</span>
      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-modal)] backdrop:bg-overlay"
        aria-labelledby="confirm-title"
      >
        <form method="dialog" className="grid gap-5">
          <div className="grid gap-2">
            <h2 id="confirm-title" className="text-xl font-semibold">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" value="cancel">
              Hủy
            </Button>
            <Button
              variant="destructive"
              loading={busy}
              onClick={async (event) => {
                event.preventDefault();
                await onConfirm();
                dialog.current?.close();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
