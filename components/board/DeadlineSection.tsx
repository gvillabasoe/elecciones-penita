"use client";

import { useState } from "react";
import { updateDeadlineAction } from "@/app/(app)/junta-electoral/actions";
import { BoardFeedback, useBoardAction } from "@/components/board/BoardAction";

interface Props {
  /** Valor actual en formato "YYYY-MM-DDTHH:mm", hora de Madrid. */
  current: string;
}

/** Fecha límite para editar candidaturas. Se interpreta en Europe/Madrid. */
export function DeadlineSection({ current }: Props) {
  const [value, setValue] = useState(current);
  const { state, pending, run } = useBoardAction();

  return (
    <div className="stack stack--s">
      <div className="campo">
        <label className="campo__etiqueta" htmlFor="plazo-candidaturas">
          Fecha límite de candidaturas
        </label>
        <input
          id="plazo-candidaturas"
          className="entrada"
          type="datetime-local"
          value={value}
          onChange={(input) => setValue(input.target.value)}
        />
        <span className="campo__ayuda">Hora de Madrid. Déjalo vacío para no fijar ningún plazo.</span>
      </div>

      <BoardFeedback state={state} />

      <div className="fila">
        <button
          type="button"
          className="btn btn--principal"
          disabled={pending}
          onClick={() => run(() => updateDeadlineAction({ deadline: value.length > 0 ? value : null }))}
        >
          {pending ? "Guardando…" : "Guardar plazo"}
        </button>
        <button
          type="button"
          className="btn btn--fantasma"
          disabled={pending || value.length === 0}
          onClick={() => {
            setValue("");
            run(() => updateDeadlineAction({ deadline: null }));
          }}
        >
          Quitar plazo
        </button>
      </div>
    </div>
  );
}
