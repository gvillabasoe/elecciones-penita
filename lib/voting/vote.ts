import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { databaseNow, lockRoundForUpdate } from "@/lib/election/lock";

/**
 * Emision del voto.
 *
 * Cada opcion representa a UN MIEMBRO. La seleccion es el identificador de una
 * opcion congelada: ya no existen selecciones por tipo ni votos separados para
 * una persona y su candidatura.
 *
 * Anonimato:
 *  - `VotingParticipation` guarda solo ronda y miembro. Su unica finalidad es
 *    impedir un segundo voto.
 *  - `Ballot` guarda solo ronda, opcion congelada e identificador aleatorio.
 *  - Ambas filas se crean en la misma transaccion, sin identificador comun,
 *    sin marca temporal y sin ningun rastro en logs ni auditoria.
 *
 * La validez temporal la decide PostgreSQL: se rechaza el voto cuando
 * NOW() >= votingClosesAt, con independencia del reloj del cliente.
 */

export class VoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoteError";
  }
}

export const ALREADY_VOTED_MESSAGE = "Ya has emitido tu voto en esta ronda.";

export interface BallotOptionView {
  optionId: string;
  memberId: string;
  memberName: string;
  candidacyId: string | null;
  candidacyName: string | null;
  slogan: string | null;
  hasFormalCandidacy: boolean;
  color: string;
  sortOrder: number;
}

export async function listBallotOptions(roundId: string): Promise<BallotOptionView[]> {
  const options = await prisma.roundBallotOption.findMany({
    where: { roundId },
    orderBy: { sortOrder: "asc" }
  });

  return options.map((option) => ({
    optionId: option.id,
    memberId: option.sourceMemberId,
    memberName: option.memberNameSnapshot,
    candidacyId: option.sourceCandidacyId,
    candidacyName: option.candidacyNameSnapshot,
    slogan: option.sloganSnapshot,
    hasFormalCandidacy: option.hasFormalCandidacySnapshot,
    color: option.colorSnapshot,
    sortOrder: option.sortOrder
  }));
}

export async function hasVoted(roundId: string, memberId: string): Promise<boolean> {
  const participation = await prisma.votingParticipation.findUnique({
    where: { roundId_memberId: { roundId, memberId } },
    select: { id: true }
  });
  return participation !== null;
}

/** Registra el voto. Un miembro, un voto por ronda. */
export async function castVote(options: {
  roundId: string;
  memberId: string;
  optionId: string;
}): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await lockRoundForUpdate(tx, options.roundId);

      const round = await tx.electionRound.findUnique({
        where: { id: options.roundId },
        select: { id: true, status: true, votingClosesAt: true, mode: true }
      });

      if (!round) throw new VoteError("La ronda no existe.");
      if (round.status !== "VOTING_OPEN") throw new VoteError("La votación no está abierta.");

      // Hora autoritativa de PostgreSQL, dentro de la misma transaccion.
      const serverNow = await databaseNow(tx);
      if (!round.votingClosesAt || round.votingClosesAt <= serverNow) {
        throw new VoteError("La votación ha finalizado.");
      }

      const option = await tx.roundBallotOption.findUnique({
        where: { id: options.optionId },
        select: { id: true, roundId: true }
      });

      if (!option || option.roundId !== round.id) {
        throw new VoteError("La opción elegida no pertenece a la papeleta de esta ronda.");
      }

      const member = await tx.member.findUnique({
        where: { id: options.memberId },
        select: { isActive: true }
      });
      if (!member || !member.isActive) throw new VoteError("Tu cuenta no puede votar en esta elección.");

      // 1. Participacion: impide el segundo voto (unico roundId + memberId).
      await tx.votingParticipation.create({
        data: { roundId: round.id, memberId: options.memberId }
      });

      // 2. Papeleta anonima: sin votante, sin sesion, sin marca temporal.
      await tx.ballot.create({
        data: { roundId: round.id, ballotOptionId: option.id }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new VoteError(ALREADY_VOTED_MESSAGE);
    }
    if (error instanceof VoteError) throw error;
    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      throw new VoteError("No se ha podido registrar el voto. Vuelve a intentarlo.");
    }
    throw error;
  }

  // La participacion agregada se sirve con retardo deliberado: no se invalida
  // la cache al votar, para que nadie pueda correlacionar una conexion
  // concreta con un incremento del contador.
}
