"use client";

import { useFormStatus } from "react-dom";

interface Props {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
}

/** Boton de envio que se deshabilita solo para evitar la doble pulsacion. */
export function SubmitButton({ children, pendingLabel, className, disabled }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className ?? "btn btn--principal btn--bloque"}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
