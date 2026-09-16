"use client";

import { useState, useTransition } from "react";
import type { BoardActionState } from "@/lib/election/action-state";

const VACIO: BoardActionState = { error: null, success: null };

/**
 * Ejecuta una acción administrativa evitando la doble pulsación y guardando
 * el último resultado para mostrarlo en pantalla.
 */
export function useBoardAction() {
  const [state, setState] = useState<BoardActionState>(VACIO);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<BoardActionState>, onSuccess?: () => void) => {
    setState(VACIO);
    startTransition(async () => {
      const result = await action();
      setState(result);
      if (!result.error) onSuccess?.();
    });
  };

  return { state, pending, run, reset: () => setState(VACIO) };
}

export function BoardFeedback({ state }: { state: BoardActionState }) {
  if (state.error) {
    return (
      <p className="aviso aviso--error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="aviso aviso--exito" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}
