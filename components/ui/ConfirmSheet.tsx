"use client";

import { useEffect, useId, useRef } from "react";

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

  const titleId = useId();

  // Foco inicial en la acción segura y devolución del foco al disparador al cerrar.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Evita que la página de fondo se desplace mientras la hoja está abierta.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onCancel();
        return;
      }

      // Atrapa el foco dentro del diálogo con Tab / Mayús+Tab.
      if (event.key === "Tab" && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !sheetRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !sheetRef.current.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
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
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{titulo}</h2>
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
