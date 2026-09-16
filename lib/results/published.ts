import type { ElectionRound } from "@prisma/client";
import { maskResults, type PublishedResults } from "@/lib/results/mask";
import { detectFirstPlaceTie, type FirstPlaceTie, type RevealStage } from "@/lib/results/ranking";
import { tallyRound } from "@/lib/results/tally";

export type { PublishedResults };

/**
 * Resultados publicados.
 *
 * Unica puerta de salida del recuento hacia cualquier pantalla, incluida la
 * Junta Electoral. La mascara se aplica en SERVIDOR: al cliente solo viajan
 * los grupos de la fase ya publicada. Nunca se envian posiciones futuras, ni
 * ocultas con CSS, ni en props, ni en JSON.
 */
export async function publishedResults(round: ElectionRound): Promise<PublishedResults> {
  const tally = await tallyRound(round.id);

  return maskResults({
    roundId: round.id,
    roundNumber: round.roundNumber,
    stage: round.resultsRevealStage as RevealStage,
    groups: tally.groups,
    totalValidVotes: tally.totalValidVotes,
    participationCount: tally.participationCount,
    ballotCount: tally.ballotCount
  });
}

/**
 * Empate en primera posicion YA PUBLICO.
 *
 * La segunda vuelta solo puede decidirse a partir de informacion publicada:
 * nunca desde una vista privada de la Junta.
 */
export async function publicFirstPlaceTie(round: ElectionRound): Promise<FirstPlaceTie | null> {
  if (round.resultsRevealStage !== "PODIUM_REVEALED") return null;
  const tally = await tallyRound(round.id);
  return detectFirstPlaceTie(tally.groups);
}
