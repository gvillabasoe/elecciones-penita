"use client";

import { useState } from "react";
import type { ElectionMode } from "@prisma/client";
import {
  createRunoffAction,
  revealFourthFifthAction,
  revealLowerAction,
  revealPodiumAction
} from "@/app/(app)/junta-electoral/actions";
import { BoardFeedback, useBoardAction } from "@/components/board/BoardAction";
import { ModeBanner } from "@/components/election/ModeBanner";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import type { RoundIntegrity } from "@/lib/results/integrity";
import type { RevealStage } from "@/lib/results/ranking";

export type StepState =
  | "PENDIENTE"
  | "DISPONIBLE"
  | "BLOQUEADO"
  | "EN_EJECUCION"
  | "COMPLETADO"
  | "NO_APLICABLE";

const STEP_STATE_LABELS: Record<StepState, string> = {
  PENDIENTE: "Pendiente",
  DISPONIBLE: "Disponible",
  BLOQUEADO: "Bloqueado",
  EN_EJECUCION: "En ejecución",
  COMPLETADO: "Completado",
  NO_APLICABLE: "No aplicable"
};

export const REVEAL_CONFIRMATION =
  "Se publicará la siguiente fase de resultados. Esta acción es irreversible y no podrá ocultarse de nuevo.";

interface RunoffView {
  available: boolean;
  reason: string | null;
  tiedOptionNames: string[];
  tiedVotes: number;
}

interface Props {
  roundId: string;
  roundLabel: string;
  mode: ElectionMode;
  stage: RevealStage;
  integrity: RoundIntegrity;
  /** Solo para la primera vuelta. */
  runoff: RunoffView | null;
  runoffExists: boolean;
}

type Sheet = "lower" | "fourthFifth" | "podium" | "runoff-info" | "runoff-confirm" | null;

/**
 * Proceso guiado de publicacion de resultados.
 *
 * No hay switches: cada fase es un paso con estado explicito y un boton
 * propio. La confirmacion no muestra ningun dato oculto (ni nombres, ni
 * posiciones, ni votos, ni porcentajes, ni el orden futuro). Al completarse,
 * el boton se sustituye por "Completado" y no puede revertirse.
 */
export function RevealStepper({
  roundId,
  roundLabel,
  mode,
  stage,
  integrity,
  runoff,
  runoffExists
}: Props) {
  const { state, pending, run } = useBoardAction();
  const [sheet, setSheet] = useState<Sheet>(null);

  const lowerDone = stage !== "HIDDEN";
  const fourthFifthDone = stage === "FOURTH_FIFTH_REVEALED" || stage === "PODIUM_REVEALED";
  const podiumDone = stage === "PODIUM_REVEALED";

  const lowerState: StepState = lowerDone
    ? "COMPLETADO"
    : integrity.nextStageReady && integrity.nextStage === "LOWER_RANKS_REVEALED"
      ? "DISPONIBLE"
      : integrity.roundClosed
        ? "BLOQUEADO"
        : "PENDIENTE";

  const fourthFifthState: StepState = fourthFifthDone
    ? "COMPLETADO"
    : lowerDone
      ? "DISPONIBLE"
      : "PENDIENTE";

  const podiumState: StepState = podiumDone
    ? "COMPLETADO"
    : fourthFifthDone
      ? "DISPONIBLE"
      : "PENDIENTE";

  const finalState: StepState = podiumDone ? "COMPLETADO" : "PENDIENTE";

  const step = (
    index: number,
    title: string,
    stepState: StepState,
    description: string,
    action: React.ReactNode
  ) => (
    <li
      className={
        stepState === "COMPLETADO"
          ? "paso paso--completado"
          : stepState === "DISPONIBLE"
            ? "paso paso--disponible"
            : "paso"
      }
    >
      <span className="paso__numero" aria-hidden="true">
        {stepState === "COMPLETADO" ? "✓" : index}
      </span>
      <div className="paso__cuerpo">
        <span className="paso__titulo">{title}</span>
        <span className="paso__estado">{STEP_STATE_LABELS[stepState]}</span>
        <span className="texto-secundario">{description}</span>
        {action}
      </div>
    </li>
  );

  return (
    <div className="stack stack--s">
      <ModeBanner mode={mode} />

      <div className="fila fila--separada">
        <span style={{ fontWeight: 600 }}>{roundLabel}</span>
        <span className="chip chip--neutro texto-cifra">
          {integrity.participationCount} participaciones · {integrity.ballotCount} papeletas
        </span>
      </div>

      <BoardFeedback state={state} />

      {integrity.blockedReason && !podiumDone ? (
        <p className="aviso">{integrity.blockedReason}</p>
      ) : null}

      <ol className="pasos">
        {step(
          1,
          "Resultados inferiores",
          lowerState,
          "Publica todas las opciones con votos excepto las cinco primeras posiciones.",
          lowerState === "COMPLETADO" ? (
            <span className="chip chip--activo">Completado</span>
          ) : (
            <button
              type="button"
              className="btn btn--principal"
              disabled={pending || lowerState !== "DISPONIBLE"}
              onClick={() => setSheet("lower")}
            >
              Mostrar resultados inferiores
            </button>
          )
        )}

        {step(
          2,
          "Puestos 4 y 5",
          fourthFifthState,
          "Publica primero la quinta posición y después la cuarta, si existen.",
          fourthFifthState === "COMPLETADO" ? (
            <span className="chip chip--activo">Completado</span>
          ) : (
            <button
              type="button"
              className="btn btn--principal"
              disabled={pending || fourthFifthState !== "DISPONIBLE"}
              onClick={() => setSheet("fourthFifth")}
            >
              Revelar puestos 4 y 5
            </button>
          )
        )}

        {step(
          3,
          "Podio",
          podiumState,
          "Publica la tercera posición, después la segunda y por último la primera.",
          podiumState === "COMPLETADO" ? (
            <span className="chip chip--activo">Completado</span>
          ) : (
            <button
              type="button"
              className="btn btn--principal"
              disabled={pending || podiumState !== "DISPONIBLE"}
              onClick={() => setSheet("podium")}
            >
              Revelar podio
            </button>
          )
        )}

        {step(
          4,
          "Resultado completo publicado",
          finalState,
          "Todas las fases están públicas y visibles para todos los miembros.",
          null
        )}
      </ol>

      {runoff ? (
        <div className="stack stack--s">
          <h3 style={{ margin: 0 }}>Segunda vuelta</h3>
          {runoffExists ? (
            <p className="texto-secundario" style={{ margin: 0 }}>
              Ya existe una segunda vuelta. Configura su duración e inícialo manualmente.
            </p>
          ) : runoff.available ? (
            <>
              <p className="texto-secundario" style={{ margin: 0 }}>
                Empate público en primera posición con {runoff.tiedVotes} voto
                {runoff.tiedVotes === 1 ? "" : "s"}: {runoff.tiedOptionNames.join(", ")}.
              </p>
              <button
                type="button"
                className="btn btn--acento btn--bloque"
                disabled={pending}
                onClick={() => setSheet("runoff-info")}
              >
                Crear segunda vuelta
              </button>
            </>
          ) : (
            <p className="texto-secundario" style={{ margin: 0 }}>
              {runoff.reason}
            </p>
          )}
        </div>
      ) : null}

      {sheet === "lower" ? (
        <ConfirmSheet
          titulo="Mostrar resultados inferiores"
          confirmLabel="Publicar fase"
          pendingLabel="Publicando…"
          pending={pending}
          onConfirm={() => run(() => revealLowerAction({ roundId, mode }), () => setSheet(null))}
          onCancel={() => setSheet(null)}
        >
          <ModeBanner mode={mode} />
          <p>{REVEAL_CONFIRMATION}</p>
          <p className="texto-secundario">
            Se publicarán las posiciones a partir de la sexta. Las cinco primeras seguirán ocultas.
          </p>
        </ConfirmSheet>
      ) : null}

      {sheet === "fourthFifth" ? (
        <ConfirmSheet
          titulo="Revelar puestos 4 y 5"
          confirmLabel="Publicar fase"
          pendingLabel="Publicando…"
          pending={pending}
          onConfirm={() => run(() => revealFourthFifthAction({ roundId, mode }), () => setSheet(null))}
          onCancel={() => setSheet(null)}
        >
          <ModeBanner mode={mode} />
          <p>{REVEAL_CONFIRMATION}</p>
          <p className="texto-secundario">
            Se publicarán las posiciones cuarta y quinta si existen. El podio seguirá oculto.
          </p>
        </ConfirmSheet>
      ) : null}

      {sheet === "podium" ? (
        <ConfirmSheet
          titulo="Revelar podio"
          confirmLabel="Publicar fase"
          pendingLabel="Publicando…"
          pending={pending}
          onConfirm={() => run(() => revealPodiumAction({ roundId, mode }), () => setSheet(null))}
          onCancel={() => setSheet(null)}
        >
          <ModeBanner mode={mode} />
          <p>{REVEAL_CONFIRMATION}</p>
          <p className="texto-secundario">
            Se publicarán las tres primeras posiciones y el resultado quedará completo.
          </p>
        </ConfirmSheet>
      ) : null}

      {sheet === "runoff-info" && runoff ? (
        <ConfirmSheet
          titulo="Segunda vuelta"
          confirmLabel="Continuar"
          cancelLabel="Cancelar"
          onConfirm={() => setSheet("runoff-confirm")}
          onCancel={() => setSheet(null)}
        >
          <ModeBanner mode={mode} />
          <p>
            Se creará una nueva ronda únicamente con los miembros empatados en primera posición. Todos los
            miembros podrán volver a votar una vez.
          </p>
          <div className="stack stack--s">
            <span style={{ fontWeight: 600 }}>Opciones empatadas</span>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {runoff.tiedOptionNames.map((optionName) => (
                <li key={optionName}>{optionName}</li>
              ))}
            </ul>
          </div>
          <p className="texto-secundario">
            La ronda anterior se mantiene intacta, con sus votos, sus resultados y su auditoría.
          </p>
        </ConfirmSheet>
      ) : null}

      {sheet === "runoff-confirm" ? (
        <ConfirmSheet
          titulo="Confirmar segunda vuelta"
          confirmLabel="Crear segunda vuelta"
          pendingLabel="Creando…"
          pending={pending}
          onConfirm={() => run(() => createRunoffAction({ roundId, mode }), () => setSheet(null))}
          onCancel={() => setSheet(null)}
        >
          <ModeBanner mode={mode} />
          <p>
            La nueva ronda queda pendiente de iniciar. No se aceptarán votos hasta que configures su
            duración y la inicies manualmente.
          </p>
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
