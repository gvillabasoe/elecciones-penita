"use client";

import { useEffect, useRef } from "react";

interface Props {
  titulo: string;
  children: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  confirmDisabled?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Hoja de confirmacion. Gestiona el foco, cierra con Escape y no permite
 * confirmar dos veces.
 */
export function ConfirmSheet({
  titulo,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Volver",
  pending = false,
  confirmDisabled = false,
  destructive = false,
  onConfirm,
  onCancel
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, pending]);

  return (
    <div className="velo" role="presentation" onClick={() => (pending ? null : onCancel())}>
      <div
        ref={sheetRef}
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{titulo}</h2>
        <div className="stack stack--s">{children}</div>
        <div className="stack stack--s">
          <button
            type="button"
            className={destructive ? "btn btn--peligro btn--bloque" : "btn btn--principal btn--bloque"}
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
            aria-busy={pending}
          >
            {pending ? (pendingLabel ?? "Enviando…") : confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--fantasma btn--bloque"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
