import { Prisma, type ElectionMode, type ElectionRound, type RoundStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ELECTION_NAME,
  ELECTION_SLUG,
  ELECTION_TEST_NAME,
  ELECTION_TEST_SLUG
} from "@/lib/members";

/**
 * Estado electoral.
 *
 * La hora de referencia es SIEMPRE la de PostgreSQL. Las paginas obtienen el
 * instante con `serverNow()` y lo propagan; el navegador solo corrige su
 * propio desfase para pintar la cuenta atras.
 *
 * Toda consulta parte de una eleccion con modo definido (TEST o LIVE): los
 * datos de ensayo y los reales nunca se mezclan.
 */

export type { ElectionMode };

export interface ElectionWithRounds {
  id: string;
  name: string;
  slug: string;
  mode: ElectionMode;
  candidacyEditDeadline: Date | null;
  rounds: ElectionRound[];
}

export class ElectionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElectionStateError";
  }
}

export const ELECTION_SLUG_BY_MODE: Record<ElectionMode, string> = {
  LIVE: ELECTION_SLUG,
  TEST: ELECTION_TEST_SLUG
};

export const ELECTION_NAME_BY_MODE: Record<ElectionMode, string> = {
  LIVE: ELECTION_NAME,
  TEST: ELECTION_TEST_NAME
};

export { MODE_LABELS, TEST_MODE_BANNER } from "@/lib/election/mode";

/** Hora autoritativa: la del servidor de base de datos. */
export async function serverNow(): Promise<Date> {
  const rows = await prisma.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT NOW() AS "now"`);
  const first = rows[0];
  if (!first) throw new ElectionStateError("No se ha podido obtener la hora del servidor.");
  return first.now instanceof Date ? first.now : new Date(first.now);
}

export async function getElectionOrNull(mode: ElectionMode = "LIVE"): Promise<ElectionWithRounds | null> {
  return prisma.election.findFirst({
    where: { slug: ELECTION_SLUG_BY_MODE[mode], mode },
    select: {
      id: true,
      name: true,
      slug: true,
      mode: true,
      candidacyEditDeadline: true,
      rounds: { orderBy: { roundNumber: "asc" } }
    }
  });
}

export async function getElection(mode: ElectionMode = "LIVE"): Promise<ElectionWithRounds> {
  const election = await getElectionOrNull(mode);

  if (!election) {
    throw new ElectionStateError(
      `No existe la elección "${ELECTION_NAME_BY_MODE[mode]}". Ejecuta el seed antes de usar la aplicación.`
    );
  }

  return election;
}

/** Ronda visible por defecto: la de mayor numero. */
export function currentRound(rounds: readonly ElectionRound[]): ElectionRound {
  const last = [...rounds].sort((a, b) => b.roundNumber - a.roundNumber)[0];
  if (!last) throw new ElectionStateError("La elección no tiene ninguna ronda configurada.");
  return last;
}

export function findRound(rounds: readonly ElectionRound[], roundNumber: number): ElectionRound | null {
  return rounds.find((round) => round.roundNumber === roundNumber) ?? null;
}

/** Estado efectivo de la ronda teniendo en cuenta la hora de PostgreSQL. */
export function effectiveStatus(round: ElectionRound, now: Date): RoundStatus {
  if (round.status === "VOTING_OPEN" && round.votingClosesAt && round.votingClosesAt <= now) {
    return round.resultsCountdownStartedAt ? "RESULTS_WAITING" : "VOTING_CLOSED";
  }
  return round.status;
}

export function isVotingOpen(round: ElectionRound, now: Date): boolean {
  return (
    round.status === "VOTING_OPEN" &&
    round.votingClosesAt !== null &&
    round.votingClosesAt > now
  );
}

export function hasVotingFinished(round: ElectionRound, now: Date): boolean {
  const status = effectiveStatus(round, now);
  return status !== "READY_TO_START" && status !== "VOTING_OPEN";
}

/** La cuenta atras de resultados ha terminado o nunca se configuro. */
export function resultsCountdownElapsed(round: ElectionRound, now: Date): boolean {
  if (!round.resultsRevealAt) return true;
  return round.resultsRevealAt <= now;
}

/** La primera fase de resultados esta disponible. */
export function canRevealLowerRanks(round: ElectionRound, now: Date): boolean {
  return (
    hasVotingFinished(round, now) &&
    round.resultsRevealStage === "HIDDEN" &&
    resultsCountdownElapsed(round, now)
  );
}

export function candidacyPeriodOpen(
  election: Pick<ElectionWithRounds, "candidacyEditDeadline">,
  firstRound: ElectionRound,
  now: Date
): boolean {
  if (firstRound.status !== "READY_TO_START") return false;
  if (!election.candidacyEditDeadline) return true;
  return election.candidacyEditDeadline > now;
}

/**
 * Cierra las rondas cuyo plazo ya vencio.
 *
 * La comparacion y la marca de cierre las calcula PostgreSQL con NOW() en una
 * unica sentencia condicional: no interviene ningun reloj de navegador ni de
 * instancia. Es idempotente y segura frente a concurrencia.
 */
export async function settleExpiredRounds(mode?: ElectionMode): Promise<number> {
  if (mode) {
    return prisma.$executeRaw(Prisma.sql`
      UPDATE "ElectionRound"
      SET "status" = 'VOTING_CLOSED',
          "votingClosedAt" = COALESCE("votingClosesAt", NOW()),
          "updatedAt" = NOW()
      WHERE "status" = 'VOTING_OPEN'
        AND "votingClosesAt" IS NOT NULL
        AND "votingClosesAt" <= NOW()
        AND "mode" = ${mode}::"ElectionMode"
    `);
  }

  return prisma.$executeRaw(Prisma.sql`
    UPDATE "ElectionRound"
    SET "status" = 'VOTING_CLOSED',
        "votingClosedAt" = COALESCE("votingClosesAt", NOW()),
        "updatedAt" = NOW()
    WHERE "status" = 'VOTING_OPEN'
      AND "votingClosesAt" IS NOT NULL
      AND "votingClosesAt" <= NOW()
  `);
}

/** Carga una ronda comprobando que pertenece al modo esperado. */
export async function requireRoundInMode(
  roundId: string,
  mode: ElectionMode,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ElectionRound> {
  const round = await client.electionRound.findUnique({ where: { id: roundId } });
  if (!round) throw new ElectionStateError("La ronda no existe.");
  if (round.mode !== mode) {
    throw new ElectionStateError(
      mode === "TEST"
        ? "Esta acción solo puede aplicarse a una ronda de prueba."
        : "Esta acción solo puede aplicarse a una ronda de la elección real."
    );
  }
  return round;
}

export interface RoundPublicState {
  roundId: string;
  roundNumber: number;
  status: RoundStatus;
  revealStage: ElectionRound["resultsRevealStage"];
  votingClosesAt: string | null;
  resultsRevealAt: string | null;
  serverNow: string;
}

export function roundPublicState(round: ElectionRound, now: Date): RoundPublicState {
  return {
    roundId: round.id,
    roundNumber: round.roundNumber,
    status: effectiveStatus(round, now),
    revealStage: round.resultsRevealStage,
    votingClosesAt: round.votingClosesAt ? round.votingClosesAt.toISOString() : null,
    resultsRevealAt: round.resultsRevealAt ? round.resultsRevealAt.toISOString() : null,
    serverNow: now.toISOString()
  };
}

export const ROUND_LABELS: Record<number, string> = {
  1: "Primera vuelta",
  2: "Segunda vuelta"
};

export function roundLabel(roundNumber: number): string {
  return ROUND_LABELS[roundNumber] ?? `Ronda ${roundNumber}`;
}

export const STATUS_LABELS: Record<RoundStatus, string> = {
  READY_TO_START: "Pendiente de iniciar",
  VOTING_OPEN: "Votación abierta",
  VOTING_CLOSED: "Votación finalizada",
  RESULTS_WAITING: "Resultados en espera",
  RESULTS_REVEALING: "Resultados en revelación",
  RESULTS_PUBLISHED: "Resultados publicados"
};
