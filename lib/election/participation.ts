import type { ElectionRound } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasVotingFinished } from "@/lib/election/state";

/**
 * Participacion agregada y anonima.
 *
 * Solo se publican totales. Nunca se expone quien ha votado, quien no, el
 * orden de participacion, ni ninguna marca temporal individual: la papeleta
 * no guarda timestamp y la participacion tampoco.
 *
 * Mientras la votacion esta abierta el valor se sirve de una cache con una
 * ventana minima de cinco minutos, para que nadie pueda correlacionar una
 * conexion concreta con un incremento del contador. Al cerrar, el total pasa
 * a ser exacto y definitivo.
 */

export const PARTICIPATION_CACHE_WINDOW_MS = 5 * 60 * 1000;

export interface ParticipationSummary {
  participationCount: number;
  eligibleVoterCount: number;
  participationPercentage: number;
  isFinal: boolean;
}

interface CacheEntry {
  value: ParticipationSummary;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Solo para pruebas y para el reinicio de simulaciones. */
export function clearParticipationCache(roundId?: string): void {
  if (roundId) cache.delete(roundId);
  else cache.clear();
}

async function computeSummary(round: ElectionRound, isFinal: boolean): Promise<ParticipationSummary> {
  // El denominador es el derecho a EMITIR voto: todos los miembros activos.
  // La exclusion como opcion votable no quita el derecho a votar.
  const [participationCount, eligibleVoterCount] = await Promise.all([
    prisma.votingParticipation.count({ where: { roundId: round.id } }),
    prisma.member.count({ where: { isActive: true } })
  ]);

  const participationPercentage =
    eligibleVoterCount > 0
      ? Math.round((participationCount / eligibleVoterCount) * 1000) / 10
      : 0;

  return { participationCount, eligibleVoterCount, participationPercentage, isFinal };
}

export async function participationSummary(
  round: ElectionRound,
  now: Date
): Promise<ParticipationSummary> {
  const finished = hasVotingFinished(round, now);

  if (finished) {
    cache.delete(round.id);
    return computeSummary(round, true);
  }

  const cached = cache.get(round.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await computeSummary(round, false);
  cache.set(round.id, { value, expiresAt: Date.now() + PARTICIPATION_CACHE_WINDOW_MS });
  return value;
}
