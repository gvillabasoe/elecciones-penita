import type { ElectionRound, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NEXT_STAGE, type RevealStage } from "@/lib/results/ranking";
import { hasVotingFinished, resultsCountdownElapsed } from "@/lib/election/state";

/**
 * Verificaciones de integridad para la Junta Electoral.
 *
 * Deliberadamente NO contienen resultados: ni votos por opcion, ni ranking,
 * ni posiciones, ni ganadores, ni empates. Solo permiten comprobar que el
 * recuento es consistente antes de publicar cada fase.
 */

export interface RoundIntegrity {
  roundClosed: boolean;
  optionCount: number;
  participationCount: number;
  ballotCount: number;
  countsMatch: boolean;
  orphanBallots: number;
  tallyComputed: boolean;
  stage: RevealStage;
  nextStage: RevealStage | null;
  nextStageReady: boolean;
  blockedReason: string | null;
}

export async function roundIntegrity(
  round: ElectionRound,
  now: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<RoundIntegrity> {
  const [optionCount, participationCount, ballotCount, orphanBallots] = await Promise.all([
    client.roundBallotOption.count({ where: { roundId: round.id } }),
    client.votingParticipation.count({ where: { roundId: round.id } }),
    client.ballot.count({ where: { roundId: round.id } }),
    client.ballot.count({
      where: { roundId: round.id, ballotOption: { roundId: { not: round.id } } }
    })
  ]);

  const closed = hasVotingFinished(round, now);
  const stage = round.resultsRevealStage as RevealStage;
  const nextStage = NEXT_STAGE[stage];

  let blockedReason: string | null = null;
  if (!closed) {
    blockedReason = "La votación todavía no ha finalizado.";
  } else if (nextStage === null) {
    blockedReason = "El resultado completo ya está publicado.";
  } else if (stage === "HIDDEN" && !resultsCountdownElapsed(round, now)) {
    blockedReason = "La cuenta atrás de resultados todavía no ha terminado.";
  } else if (orphanBallots > 0) {
    blockedReason = "Hay papeletas que no corresponden a la papeleta congelada de esta ronda.";
  } else if (participationCount !== ballotCount) {
    blockedReason = "El número de participaciones y de papeletas no coincide.";
  }

  return {
    roundClosed: closed,
    optionCount,
    participationCount,
    ballotCount,
    countsMatch: participationCount === ballotCount,
    orphanBallots,
    tallyComputed: closed && orphanBallots === 0,
    stage,
    nextStage,
    nextStageReady: blockedReason === null,
    blockedReason
  };
}
