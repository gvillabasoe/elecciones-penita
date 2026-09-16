"use client";

import { useState } from "react";
import { resetSimulationAction } from "@/app/(app)/junta-electoral/actions";
import { BoardFeedback, useBoardAction } from "@/components/board/BoardAction";
import { ModeBanner } from "@/components/election/ModeBanner";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";

interface Props {
  roundId: string;
  label: string;
  ballots: number;
  participations: number;
  options: number;
}

const PALABRA = "REINICIAR";

/**
 * Reiniciar simulacion.
 *
 * Solo opera sobre datos ficticios de una ronda en modo TEST: nunca acepta ni
 * modifica datos de la eleccion real. La base de datos lo refuerza con
 * disparadores que impiden borrar papeletas o participaciones en modo LIVE.
 */
export function SimulationSection({ roundId, label, ballots, participations, options }: Props) {
  const { state, pending, run } = useBoardAction();
  const [step, setStep] = useState<1 | 2 | null>(null);
  const [confirmation, setConfirmation] = useState("");

  const close = () => {
    setStep(null);
    setConfirmation("");
  };

  return (
    <div className="stack stack--s">
      <div className="fila fila--separada">
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span className="chip chip--neutro texto-cifra">
          {ballots} papeletas ficticias · {participations} participaciones
        </span>
      </div>

      <BoardFeedback state={state} />

      <button
        type="button"
        className="btn btn--peligro btn--bloque"
        disabled={pending}
        onClick={() => setStep(1)}
      >
        Reiniciar simulación
      </button>

      <p className="texto-secundario" style={{ margin: 0 }}>
        Permite repetir el ensayo tantas veces como haga falta. No existe ninguna acción equivalente
        para la elección real.
      </p>

      {step === 1 ? (
        <ConfirmSheet
          titulo={`Reiniciar la simulación (${label.toLowerCase()})`}
          confirmLabel="Continuar"
          cancelLabel="Cancelar"
          destructive
          onConfirm={() => setStep(2)}
          onCancel={close}
        >
          <ModeBanner mode="TEST" />
          <p>
            <strong>Se eliminarán:</strong> las {ballots} papeletas ficticias, los {participations}{" "}
            registros de participación, las {options} opciones congeladas y los temporizadores de esta
            ronda de prueba.
          </p>
          <p>
            <strong>Se conservarán:</strong> los miembros y sus credenciales, las candidaturas de la
            simulación con sus colores, las exclusiones y la auditoría.
          </p>
          <p className="texto-secundario">
            La elección real no se ve afectada en ningún caso.
          </p>
        </ConfirmSheet>
      ) : null}

      {step === 2 ? (
        <ConfirmSheet
          titulo="Confirmación final"
          confirmLabel="Reiniciar simulación"
          pendingLabel="Reiniciando…"
          pending={pending}
          confirmDisabled={confirmation !== PALABRA}
          destructive
          onConfirm={() =>
            run(() => resetSimulationAction({ roundId, mode: "TEST", confirmation }), close)
          }
          onCancel={close}
        >
          <ModeBanner mode="TEST" />
          <p>
            Escribe exactamente <strong>{PALABRA}</strong> para confirmar.
          </p>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor={`reinicio-${roundId}`}>
              Confirmación
            </label>
            <input
              id={`reinicio-${roundId}`}
              className={
                confirmation.length > 0 && confirmation !== PALABRA ? "entrada entrada--invalida" : "entrada"
              }
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={confirmation}
              onChange={(input) => setConfirmation(input.target.value)}
            />
          </div>
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
