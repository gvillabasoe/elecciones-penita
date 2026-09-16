"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/(app)/actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn--fantasma btn--pequeno"
      disabled={pending}
      onClick={() => startTransition(() => void logoutAction())}
    >
      {pending ? "Saliendo…" : "Salir"}
    </button>
  );
}
