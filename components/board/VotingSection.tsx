"use client";

import { useState } from "react";
import type { ElectionMode, RoundStatus } from "@prisma/client";
import {
  configureDurationAction,
  finishSimulationAction,
  startResultsCountdownAction,
  startVotingAction
} from "@/app/(app)/junta-electoral/actions";
import { BoardFeedback, useBoardAction } from "@/components/board/BoardAction";
import { Countdown } from "@/components/election/Countdown";
import { ModeBanner } from "@/components/election/ModeBanner";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import type { ParticipationSummary } from "@/lib/election/participation";
import { RESULTS_COUNTDOWN_PRESETS, VOTING_DURATION_PRESETS } from "@/lib/time/constants";

export interface VotingRoundView {
  roundId: string;
  roundNumber: number;
  label: string;
  mode: ElectionMode;
  status: RoundStatus;
  revealStage: string;
  votingDurationSeconds: number | null;
  votingClosesAt: string | null;
  resultsCountdownDurationSeconds: number | null;
  resultsRevealAt: string | null;
  frozenOptions: number;
  preview: {
    votableMembers: number;
    withCandidacy: number;
    withoutCandidacy: number;
    excluded: number;
  };
}

interface Props {
  round: VotingRoundView;
  serverNowIso: string;
  participation: ParticipationSummary | null;
  integrityNote: string | null;
}

export function describeSeconds(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "sin configurar";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} d`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (rest > 0) parts.push(`${rest} s`);
  return parts.join(" ");
}

/**
 * Votacion.
 *
 * El inicio es manual y usa la hora de PostgreSQL. En modo LIVE no existe
 * cierre anticipado: la ronda termina exclusivamente al alcanzar su hora de
 * cierre. En modo TEST puede finalizarse la simulacion.
 */
export function VotingSection({ round, serverNowIso, participation, integrityNote }: Props) {
  const { state, pending, run } = useBoardAction();
  const [minutes, setMinutes] = useState("");
  const [resultsSeconds, setResultsSeconds] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<"start" | "finish" | "results" | null>(null);

  const finished = round.status !== "READY_TO_START" && round.status !== "VOTING_OPEN";
  const customSeconds = minutes.trim().length > 0 ? Math.round(Number(minutes) * 60) : null;
  const isTest = round.mode === "TEST";

  return (
    <div className="stack stack--s">
      <div className="fila fila--separada">
        <span style={{ fontWeight: 600 }}>{round.label}</span>
        <span className="chip chip--neutro texto-cifra">
          Duración: {describeSeconds(round.votingDurationSeconds)}
        </span>
      </div>

      <BoardFeedback state={state} />

      {round.status === "READY_TO_START" ? (
        <>
          <section className="solido tarjeta tarjeta--compacta stack stack--s">
            <h3 style={{ margin: 0 }}>Revisión previa de la papeleta</h3>
            <p className="texto-secundario" style={{ margin: 0 }}>
              Cada miembro votable aparecerá exactamente una vez. Las candidaturas se integran en la
              opción de su presidente.
            </p>
            <div className="fila">
              <span className="chip chip--activo">{round.preview.votableMembers} opciones</span>
              <span className="chip chip--neutro">{round.preview.withCandidacy} con candidatura</span>
              <span className="chip chip--neutro">
                {round.preview.withoutCandidacy} sin candidatura formal
              </span>
              <span className="chip chip--excluido">{round.preview.excluded} excluidos</span>
            </div>
          </section>

          <p className="texto-secundario" style={{ margin: 0 }}>
            La fecha configurada no inicia la votación por sí sola: hay que iniciarla expresamente.
          </p>

          <div className="fila">
            {VOTING_DURATION_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                className={
                  round.votingDurationSeconds === preset.seconds
                    ? "btn btn--acento btn--pequeno"
                    : "btn btn--fantasma btn--pequeno"
                }
                disabled={pending}
                onClick={() =>
                  run(() =>
                    configureDurationAction({
                      roundId: round.roundId,
                      mode: round.mode,
                      seconds: preset.seconds
                    })
                  )
                }
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="campo">
            <label className="campo__etiqueta" htmlFor={`duracion-${round.roundId}`}>
              Duración personalizada (minutos)
            </label>
            <input
              id={`duracion-${round.roundId}`}
              className="entrada"
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              value={minutes}
              onChange={(input) => setMinutes(input.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn--fantasma btn--bloque"
            disabled={pending || !customSeconds || customSeconds < 10}
            onClick={() =>
              customSeconds
                ? run(() =>
                    configureDurationAction({
                      roundId: round.roundId,
                      mode: round.mode,
                      seconds: customSeconds
                    })
                  )
                : undefined
            }
          >
            Guardar duración personalizada
          </button>

          <button
            type="button"
            className="btn btn--principal btn--bloque"
            disabled={pending || !round.votingDurationSeconds}
            onClick={() => setConfirming("start")}
          >
            Iniciar votación
          </button>

          {!round.votingDurationSeconds ? (
            <p className="texto-secundario" style={{ margin: 0 }}>
              Configura primero la duración de la votación.
            </p>
          ) : null}
        </>
      ) : null}

      {round.status === "VOTING_OPEN" && round.votingClosesAt ? (
        <>
          <Countdown
            targetIso={round.votingClosesAt}
            serverNowIso={serverNowIso}
            totalSeconds={round.votingDurationSeconds}
            label="Tiempo restante para votar"
          />
          <p className="texto-secundario" style={{ margin: 0 }}>
            Papeleta congelada con {round.frozenOptions} opciones. El cierre es automático al alcanzar la
            hora prevista: no existe cierre anticipado.
          </p>

          {participation ? (
            <p className="chip chip--neutro texto-cifra">
              Han participado {participation.participationCount} de {participation.eligibleVoterCount}{" "}
              miembros
            </p>
          ) : null}

          {isTest ? (
            <button
              type="button"
              className="btn btn--peligro btn--bloque"
              disabled={pending}
              onClick={() => setConfirming("finish")}
            >
              Finalizar simulación
            </button>
          ) : null}
        </>
      ) : null}

      {finished ? (
        <>
          <p className="texto-secundario" style={{ margin: 0 }}>
            Votación finalizada. {round.frozenOptions} opciones en la papeleta.
          </p>

          {participation ? (
            <p className="chip chip--neutro texto-cifra">
              Participación final: {participation.participationCount} de{" "}
              {participation.eligibleVoterCount} miembros
            </p>
          ) : null}

          {integrityNote ? <p className="aviso">{integrityNote}</p> : null}

          {round.resultsRevealAt ? (
            <Countdown
              targetIso={round.resultsRevealAt}
              serverNowIso={serverNowIso}
              totalSeconds={round.resultsCountdownDurationSeconds}
              label="Cuenta atrás para los resultados"
              finishedLabel="Publicación habilitada"
              useTones={false}
            />
          ) : round.revealStage === "HIDDEN" ? (
            <>
              <div className="fila">
                {RESULTS_COUNTDOWN_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    type="button"
                    className={
                      resultsSeconds === preset.seconds
                        ? "btn btn--acento btn--pequeno"
                        : "btn btn--fantasma btn--pequeno"
                    }
                    onClick={() => setResultsSeconds(preset.seconds)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn--principal btn--bloque"
                disabled={pending || resultsSeconds === null}
                onClick={() => setConfirming("results")}
              >
                Iniciar cuenta atrás de resultados
              </button>
              <p className="texto-secundario" style={{ margin: 0 }}>
                Al llegar a cero no se publica nada: solo se habilita el primer paso del proceso guiado.
              </p>
            </>
          ) : null}
        </>
      ) : null}

      {confirming === "start" ? (
        <ConfirmSheet
          titulo="Iniciar votación"
          confirmLabel="Iniciar votación"
          pendingLabel="Iniciando…"
          pending={pending}
          onConfirm={() =>
            run(
              () => startVotingAction({ roundId: round.roundId, mode: round.mode }),
              () => setConfirming(null)
            )
          }
          onCancel={() => setConfirming(null)}
        >
          <ModeBanner mode={round.mode} />
          <p>
            Se abrirá la votación de la {round.label.toLowerCase()} durante{" "}
            {describeSeconds(round.votingDurationSeconds)}, con la hora del servidor de base de datos.
          </p>
          <p className="texto-secundario">
            Se congelará la papeleta con {round.preview.votableMembers} opciones, una por miembro
            votable. No podrá modificarse ni reiniciarse.
          </p>
        </ConfirmSheet>
      ) : null}

      {confirming === "finish" ? (
        <ConfirmSheet
          titulo="Finalizar simulación"
          confirmLabel="Finalizar simulación"
          pendingLabel="Finalizando…"
          pending={pending}
          destructive
          onConfirm={() =>
            run(
              () => finishSimulationAction({ roundId: round.roundId, mode: "TEST" }),
              () => setConfirming(null)
            )
          }
          onCancel={() => setConfirming(null)}
        >
          <ModeBanner mode={round.mode} />
          <p>Solo afecta a datos ficticios de esta simulación. La elección real no se modifica.</p>
        </ConfirmSheet>
      ) : null}

      {confirming === "results" && resultsSeconds !== null ? (
        <ConfirmSheet
          titulo="Iniciar cuenta atrás de resultados"
          confirmLabel="Iniciar cuenta atrás"
          pendingLabel="Iniciando…"
          pending={pending}
          onConfirm={() =>
            run(
              () =>
                startResultsCountdownAction({
                  roundId: round.roundId,
                  mode: round.mode,
                  seconds: resultsSeconds
                }),
              () => setConfirming(null)
            )
          }
          onCancel={() => setConfirming(null)}
        >
          <ModeBanner mode={round.mode} />
          <p>
            La cuenta atrás durará {describeSeconds(resultsSeconds)}. Los resultados seguirán ocultos
            para todos, incluida la Junta Electoral.
          </p>
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
