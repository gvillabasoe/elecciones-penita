import {
  detectFirstPlaceTie,
  isGroupVisible,
  missingPositionMessage,
  podiumGroups,
  type FirstPlaceTie,
  type RankGroup,
  type RevealStage
} from "@/lib/results/ranking";

/**
 * Mascara de resultados por fase.
 *
 * Funcion pura: recibe el ranking completo y devuelve UNICAMENTE lo que ya es
 * publico en la fase indicada. La usan tanto los resultados reales (en
 * servidor, antes de enviar nada al cliente) como el ensayo con datos
 * ficticios, de modo que el comportamiento es identico.
 */

export interface PublishedResults {
  roundId: string;
  roundNumber: number;
  stage: RevealStage;
  /** Solo grupos ya publicados. Vacio mientras la fase es HIDDEN. */
  groups: RankGroup[];
  /** Solo grupos del podio, y solo cuando el podio ya es publico. */
  podium: RankGroup[];
  /** Empate en primera posicion, solo cuando ya es publico. */
  firstPlaceTie: FirstPlaceTie | null;
  /** Total de votos validos. Null mientras no hay nada publicado. */
  totalValidVotes: number | null;
  /** Mensajes de posiciones inexistentes ya publicas. */
  notices: string[];
  participationCount: number;
  ballotCount: number;
}

export const EMPTY_PHASE_NOTICE = "No existen resultados que revelar en esta fase.";

export interface MaskInput {
  roundId: string;
  roundNumber: number;
  stage: RevealStage;
  groups: readonly RankGroup[];
  totalValidVotes: number;
  participationCount: number;
  ballotCount: number;
}

export function maskResults(input: MaskInput): PublishedResults {
  const base = {
    roundId: input.roundId,
    roundNumber: input.roundNumber,
    stage: input.stage,
    participationCount: input.participationCount,
    ballotCount: input.ballotCount
  };

  if (input.stage === "HIDDEN") {
    return {
      ...base,
      groups: [],
      podium: [],
      firstPlaceTie: null,
      totalValidVotes: null,
      notices: []
    };
  }

  const visible = input.groups.filter((group) => isGroupVisible(group, input.stage));
  const notices: string[] = [];

  if (visible.length === 0) notices.push(EMPTY_PHASE_NOTICE);

  if (input.stage === "FOURTH_FIFTH_REVEALED" || input.stage === "PODIUM_REVEALED") {
    for (const position of [5, 4] as const) {
      const message = missingPositionMessage(input.groups, position);
      if (message) notices.push(message);
    }
  }

  if (input.stage === "PODIUM_REVEALED") {
    for (const position of [2, 3] as const) {
      const message = missingPositionMessage(input.groups, position);
      if (message) notices.push(message);
    }
  }

  return {
    ...base,
    groups: visible,
    podium: input.stage === "PODIUM_REVEALED" ? podiumGroups(input.groups) : [],
    firstPlaceTie: input.stage === "PODIUM_REVEALED" ? detectFirstPlaceTie(input.groups) : null,
    totalValidVotes: input.totalValidVotes,
    notices
  };
}
