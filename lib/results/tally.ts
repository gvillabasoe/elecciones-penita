import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildRankGroups, totalVotes, type RankGroup, type TallyEntry } from "@/lib/results/ranking";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Recuento de una ronda.
 *
 * El recuento se obtiene EXCLUSIVAMENTE por agregacion sobre las papeletas
 * agrupadas por opcion. No existe ninguna consulta que relacione votante y
 * voto. Cada opcion representa a un miembro: no hay dos contadores que sumar.
 *
 * Este modulo es interno. Las pantallas nunca lo usan directamente: consumen
 * `publishedResults`, que aplica la mascara de la fase publicada en servidor.
 */

export interface RoundTally {
  entries: TallyEntry[];
  groups: RankGroup[];
  totalValidVotes: number;
  participationCount: number;
  ballotCount: number;
}

export async function tallyRound(roundId: string): Promise<RoundTally> {
  return tallyRoundWith(prisma, roundId);
}

/** Igual que tallyRound pero reutilizando un cliente de transaccion. */
export async function tallyRoundWith(client: Client, roundId: string): Promise<RoundTally> {
  const [options, grouped, participationCount, ballotCount] = await Promise.all([
    client.roundBallotOption.findMany({
      where: { roundId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        sourceMemberId: true,
        sourceCandidacyId: true,
        memberNameSnapshot: true,
        candidacyNameSnapshot: true,
        sloganSnapshot: true,
        colorSnapshot: true,
        hasFormalCandidacySnapshot: true,
        sortOrder: true
      }
    }),
    client.ballot.groupBy({
      by: ["ballotOptionId"],
      where: { roundId },
      _count: { _all: true }
    }),
    client.votingParticipation.count({ where: { roundId } }),
    client.ballot.count({ where: { roundId } })
  ]);

  const votesByOption = new Map<string, number>();
  for (const row of grouped) {
    votesByOption.set(row.ballotOptionId, row._count._all);
  }

  const entries: TallyEntry[] = options.map((option) => ({
    optionId: option.id,
    memberId: option.sourceMemberId,
    memberName: option.memberNameSnapshot,
    candidacyId: option.sourceCandidacyId,
    candidacyName: option.candidacyNameSnapshot,
    slogan: option.sloganSnapshot,
    hasFormalCandidacy: option.hasFormalCandidacySnapshot,
    color: option.colorSnapshot,
    sortOrder: option.sortOrder,
    votes: votesByOption.get(option.id) ?? 0
  }));

  return {
    entries,
    groups: buildRankGroups(entries),
    totalValidVotes: totalVotes(entries),
    participationCount,
    ballotCount
  };
}
