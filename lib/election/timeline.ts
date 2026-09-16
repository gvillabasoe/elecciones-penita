import {
  candidacyPeriodOpen,
  effectiveStatus,
  findRound,
  hasVotingFinished,
  type ElectionWithRounds
} from "@/lib/election/state";

/**
 * Linea temporal de la eleccion.
 *
 * Los estados se derivan SIEMPRE de la maquina de estados real (estado de las
 * rondas y fase de revelacion persistida). No existe ningun estado visual
 * paralelo y no se filtra ninguna informacion oculta: la existencia de un
 * empate solo se usa cuando ya es publica.
 */

export type PhaseState =
  | "COMPLETED"
  | "CURRENT"
  | "UPCOMING"
  | "BLOCKED"
  | "CONDITIONAL"
  | "NOT_APPLICABLE";

export const PHASE_STATE_LABELS: Record<PhaseState, string> = {
  COMPLETED: "Completada",
  CURRENT: "En curso",
  UPCOMING: "Pendiente",
  BLOCKED: "Bloqueada",
  CONDITIONAL: "Condicional",
  NOT_APPLICABLE: "No necesaria"
};

/** Icono textual: la linea temporal nunca depende solo del color. */
export const PHASE_STATE_ICONS: Record<PhaseState, string> = {
  COMPLETED: "✓",
  CURRENT: "▶",
  UPCOMING: "○",
  BLOCKED: "🔒",
  CONDITIONAL: "?",
  NOT_APPLICABLE: "—"
};

export interface TimelinePhase {
  key: string;
  label: string;
  state: PhaseState;
  detail: string | null;
  /** Instante relevante en ISO, para cuentas atras. */
  atIso: string | null;
}

export interface Timeline {
  phases: TimelinePhase[];
  nextAction: string | null;
}

export interface TimelineInput {
  election: Pick<ElectionWithRounds, "candidacyEditDeadline" | "rounds">;
  now: Date;
  /** Solo se pasa cuando el empate ya es publico. */
  publicFirstPlaceTie: boolean | null;
}

export function buildTimeline({ election, now, publicFirstPlaceTie }: TimelineInput): Timeline {
  const first = findRound(election.rounds, 1);
  const runoff = findRound(election.rounds, 2);

  const phases: TimelinePhase[] = [];
  let nextAction: string | null = null;

  if (!first) {
    return { phases, nextAction: "La elección no tiene primera vuelta configurada." };
  }

  const firstStatus = effectiveStatus(first, now);
  const firstFinished = hasVotingFinished(first, now);
  const notStarted = first.status === "READY_TO_START";
  const candidaciesOpen = candidacyPeriodOpen(election, first, now);
  const deadline = election.candidacyEditDeadline;

  // 1. Presentacion de candidaturas
  phases.push({
    key: "candidaturas",
    label: "Presentación de candidaturas",
    state: candidaciesOpen ? "CURRENT" : "COMPLETED",
    detail: deadline
      ? candidaciesOpen
        ? "Abierta hasta la fecha límite"
        : "Plazo finalizado"
      : candidaciesOpen
        ? "Abierta sin fecha límite"
        : "Cerrada al iniciar la votación",
    atIso: deadline ? deadline.toISOString() : null
  });

  // 2. Revision de candidaturas y censo
  phases.push({
    key: "revision",
    label: "Revisión de candidaturas y censo",
    state: notStarted ? (candidaciesOpen ? "UPCOMING" : "CURRENT") : "COMPLETED",
    detail: "La Junta Electoral revisa candidaturas y exclusiones",
    atIso: null
  });

  // 3. Primera vuelta
  phases.push({
    key: "primera-vuelta",
    label: "Primera vuelta",
    state: firstFinished ? "COMPLETED" : firstStatus === "VOTING_OPEN" ? "CURRENT" : "UPCOMING",
    detail:
      firstStatus === "VOTING_OPEN"
        ? "Votación abierta"
        : firstFinished
          ? "Votación cerrada"
          : first.votingDurationSeconds
            ? "Pendiente de inicio manual"
            : "Pendiente de configurar la duración",
    atIso: first.votingClosesAt ? first.votingClosesAt.toISOString() : null
  });

  // 4. Preparacion de resultados
  const preparing = firstFinished && first.resultsRevealStage === "HIDDEN";
  phases.push({
    key: "preparacion",
    label: "Preparación de resultados",
    state: first.resultsRevealStage !== "HIDDEN" ? "COMPLETED" : preparing ? "CURRENT" : "UPCOMING",
    detail: first.resultsRevealAt
      ? "Cuenta atrás en marcha"
      : preparing
        ? "Pendiente de iniciar la cuenta atrás"
        : "Tras el cierre de la votación",
    atIso: first.resultsRevealAt ? first.resultsRevealAt.toISOString() : null
  });

  // 5. Revelacion de resultados
  const revealing =
    first.resultsRevealStage === "LOWER_RANKS_REVEALED" ||
    first.resultsRevealStage === "FOURTH_FIFTH_REVEALED";
  phases.push({
    key: "revelacion",
    label: "Revelación de resultados",
    state:
      first.resultsRevealStage === "PODIUM_REVEALED"
        ? "COMPLETED"
        : revealing
          ? "CURRENT"
          : firstFinished
            ? "UPCOMING"
            : "BLOCKED",
    detail: revealing ? "Publicación por fases en curso" : "Se publica por fases",
    atIso: null
  });

  // 6. Segunda vuelta: condicional hasta que el empate sea publico
  const runoffStatus = runoff ? effectiveStatus(runoff, now) : null;
  phases.push({
    key: "segunda-vuelta",
    label: "Segunda vuelta",
    state: runoff
      ? hasVotingFinished(runoff, now)
        ? "COMPLETED"
        : runoffStatus === "VOTING_OPEN"
          ? "CURRENT"
          : "UPCOMING"
      : publicFirstPlaceTie === false
        ? "NOT_APPLICABLE"
        : "CONDITIONAL",
    detail: runoff
      ? runoffStatus === "VOTING_OPEN"
        ? "Votación abierta"
        : hasVotingFinished(runoff, now)
          ? "Votación cerrada"
          : "Pendiente de inicio manual"
      : publicFirstPlaceTie === false
        ? "No necesaria: no hay empate en primera posición"
        : "Solo si existe empate en primera posición",
    atIso: runoff?.votingClosesAt ? runoff.votingClosesAt.toISOString() : null
  });

  // 7. Resultado final
  const lastRound = runoff ?? first;
  const finalPublished =
    lastRound.resultsRevealStage === "PODIUM_REVEALED" &&
    (runoff !== null || publicFirstPlaceTie === false);
  phases.push({
    key: "resultado-final",
    label: "Resultado final",
    state: finalPublished ? "COMPLETED" : "UPCOMING",
    detail: finalPublished ? "Publicado" : "Tras la revelación completa",
    atIso: null
  });

  // Proxima accion visible, sin filtrar nada oculto
  if (candidaciesOpen) nextAction = "Presentar o editar candidaturas.";
  else if (notStarted) nextAction = "La Junta Electoral iniciará la votación.";
  else if (firstStatus === "VOTING_OPEN") nextAction = "Votar antes del cierre.";
  else if (preparing && !first.resultsRevealAt) nextAction = "La Junta iniciará la cuenta atrás de resultados.";
  else if (preparing) nextAction = "Esperar el final de la cuenta atrás de resultados.";
  else if (revealing) nextAction = "La Junta publicará la siguiente fase de resultados.";
  else if (runoff && runoff.status === "READY_TO_START") nextAction = "La Junta iniciará la segunda vuelta.";
  else if (runoffStatus === "VOTING_OPEN") nextAction = "Votar en la segunda vuelta antes del cierre.";
  else if (finalPublished) nextAction = null;
  else nextAction = "Consultar los resultados publicados.";

  return { phases, nextAction };
}
