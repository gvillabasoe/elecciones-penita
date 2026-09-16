import type { ElectionMode, ElectionRound, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAudit } from "@/lib/election/audit";
import { databaseNow, lockElectionForUpdate, lockRoundForUpdate } from "@/lib/election/lock";
import { clearParticipationCache } from "@/lib/election/participation";
import {
  canRevealLowerRanks,
  hasVotingFinished,
  resultsCountdownElapsed
} from "@/lib/election/state";
import { detectFirstPlaceTie } from "@/lib/results/ranking";
import { tallyRoundWith } from "@/lib/results/tally";
import { memberOptionColor } from "@/lib/theme/member-color";

/**
 * Transiciones de ronda.
 *
 * Todas toman un bloqueo de fila sobre la ronda, comprueban el modo esperado
 * (TEST o LIVE), validan el estado de partida y usan NOW() de PostgreSQL como
 * unica referencia temporal. Solo una transaccion puede completar cada
 * transicion.
 *
 * En modo LIVE no existe cierre anticipado ni reinicio: la ronda real termina
 * exclusivamente al alcanzar su hora de cierre.
 */

export class RoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoundError";
  }
}

async function loadRound(
  tx: Prisma.TransactionClient,
  roundId: string,
  mode: ElectionMode
): Promise<ElectionRound> {
  await lockRoundForUpdate(tx, roundId);
  const round = await tx.electionRound.findUnique({ where: { id: roundId } });
  if (!round) throw new RoundError("La ronda no existe.");
  if (round.mode !== mode) {
    throw new RoundError(
      mode === "TEST"
        ? "Esta acción solo puede aplicarse a una ronda de prueba."
        : "Esta acción solo puede aplicarse a una ronda de la elección real."
    );
  }
  return round;
}

// ---------------------------------------------------------------------------
// Papeleta congelada: exactamente una opcion por miembro
// ---------------------------------------------------------------------------

/**
 * Genera las opciones congeladas si todavia no existen.
 *
 * Ronda 1: una opcion por miembro elegible. Si el miembro tiene candidatura
 *          activa y valida, sus datos enriquecen esa misma opcion.
 * Ronda 2: exclusivamente los miembros empatados en primera posicion de su
 *          ronda de origen, que permanece intacta.
 */
async function freezeBallotOptions(
  tx: Prisma.TransactionClient,
  round: ElectionRound
): Promise<number> {
  const existing = await tx.roundBallotOption.count({ where: { roundId: round.id } });
  if (existing > 0) return existing;

  if (round.roundNumber === 2) {
    if (!round.sourceRoundId) throw new RoundError("La segunda vuelta no está ligada a la primera.");
    return freezeRunoffOptions(tx, round.id, round.sourceRoundId);
  }

  const [excluded, members, candidacies] = await Promise.all([
    tx.electionEligibility.findMany({
      where: { electionId: round.electionId, isEligible: false },
      select: { memberId: true }
    }),
    tx.member.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, displayName: true }
    }),
    // Una candidatura marcada como no valida no enriquece la opcion.
    tx.candidacy.findMany({
      where: {
        electionId: round.electionId,
        isDeleted: false,
        reviewStatus: { not: "INVALID" }
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slogan: true, pastelColor: true, presidentId: true }
    })
  ]);

  const excludedIds = new Set(excluded.map((row) => row.memberId));
  const candidacyByPresident = new Map(candidacies.map((row) => [row.presidentId, row]));

  const rows: Prisma.RoundBallotOptionCreateManyInput[] = [];
  let sortOrder = 0;

  for (const member of members) {
    if (excludedIds.has(member.id)) continue;
    const candidacy = candidacyByPresident.get(member.id) ?? null;
    sortOrder += 1;

    rows.push({
      roundId: round.id,
      sourceMemberId: member.id,
      sourceCandidacyId: candidacy ? candidacy.id : null,
      memberNameSnapshot: member.displayName,
      candidacyNameSnapshot: candidacy ? candidacy.name : null,
      sloganSnapshot: candidacy ? candidacy.slogan : null,
      colorSnapshot: candidacy ? candidacy.pastelColor : memberOptionColor(member.slug),
      hasFormalCandidacySnapshot: candidacy !== null,
      sortOrder
    });
  }

  if (rows.length === 0) {
    throw new RoundError("No hay ninguna persona votable: revisa las exclusiones.");
  }

  await tx.roundBallotOption.createMany({ data: rows });
  return rows.length;
}

/** Copia las opciones empatadas en primera posicion, sin duplicar candidatura. */
async function freezeRunoffOptions(
  tx: Prisma.TransactionClient,
  roundId: string,
  sourceRoundId: string
): Promise<number> {
  const tally = await tallyRoundWith(tx, sourceRoundId);
  const tie = detectFirstPlaceTie(tally.groups);

  if (!tie.isTie || tie.votes <= 0) {
    throw new RoundError("La segunda vuelta solo está disponible cuando existe un empate en primera posición.");
  }

  const sourceOptions = await tx.roundBallotOption.findMany({
    where: { id: { in: tie.options.map((option) => option.optionId) } },
    orderBy: { sortOrder: "asc" }
  });

  const rows: Prisma.RoundBallotOptionCreateManyInput[] = sourceOptions.map((option, index) => ({
    roundId,
    sourceMemberId: option.sourceMemberId,
    sourceCandidacyId: option.sourceCandidacyId,
    memberNameSnapshot: option.memberNameSnapshot,
    candidacyNameSnapshot: option.candidacyNameSnapshot,
    sloganSnapshot: option.sloganSnapshot,
    colorSnapshot: option.colorSnapshot,
    hasFormalCandidacySnapshot: option.hasFormalCandidacySnapshot,
    sortOrder: index + 1
  }));

  if (rows.length === 0) throw new RoundError("No hay opciones empatadas que trasladar a la segunda vuelta.");

  await tx.roundBallotOption.createMany({ data: rows });
  return rows.length;
}

/** Vista previa de la papeleta antes de iniciar. No revela ningun resultado. */
export async function ballotPreview(electionId: string): Promise<{
  votableMembers: number;
  withCandidacy: number;
  withoutCandidacy: number;
  excluded: number;
}> {
  const [excludedRows, activeMembers, candidacies] = await Promise.all([
    prisma.electionEligibility.findMany({
      where: { electionId, isEligible: false },
      select: { memberId: true }
    }),
    prisma.member.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.candidacy.findMany({
      where: { electionId, isDeleted: false, reviewStatus: { not: "INVALID" } },
      select: { presidentId: true }
    })
  ]);

  const excluded = new Set(excludedRows.map((row) => row.memberId));
  const withCandidacyIds = new Set(candidacies.map((row) => row.presidentId));

  let withCandidacy = 0;
  let withoutCandidacy = 0;

  for (const member of activeMembers) {
    if (excluded.has(member.id)) continue;
    if (withCandidacyIds.has(member.id)) withCandidacy += 1;
    else withoutCandidacy += 1;
  }

  return {
    votableMembers: withCandidacy + withoutCandidacy,
    withCandidacy,
    withoutCandidacy,
    excluded: excluded.size
  };
}

// ---------------------------------------------------------------------------
// Configuracion y arranque
// ---------------------------------------------------------------------------

export async function configureVotingDuration(options: {
  electionId: string;
  roundId: string;
  seconds: number;
  actorMemberId: string;
  mode: ElectionMode;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, options.mode);

    if (round.status !== "READY_TO_START") {
      throw new RoundError("La duración solo puede configurarse antes de iniciar la votación.");
    }

    await tx.electionRound.update({
      where: { id: round.id },
      data: { votingDurationSeconds: options.seconds }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "VOTING_DURATION_CONFIGURED",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: { seconds: options.seconds, mode: options.mode }
    });
  });
}

export interface StartVotingResult {
  votingClosesAt: Date;
  optionCount: number;
}

/**
 * Inicio manual de la votacion.
 *
 * La fecha configurada nunca la inicia sola. La apertura y el cierre se
 * calculan con NOW() de PostgreSQL dentro de la misma transaccion.
 */
export async function startVoting(options: {
  electionId: string;
  roundId: string;
  actorMemberId: string;
  mode: ElectionMode;
}): Promise<StartVotingResult> {
  return prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, options.mode);

    if (round.status !== "READY_TO_START") {
      throw new RoundError("Esta ronda ya ha sido iniciada.");
    }
    if (!round.votingDurationSeconds) {
      throw new RoundError("Configura primero la duración de la votación.");
    }

    const optionCount = await freezeBallotOptions(tx, round);

    const serverNow = await databaseNow(tx);
    const votingClosesAt = new Date(serverNow.getTime() + round.votingDurationSeconds * 1000);

    await tx.electionRound.update({
      where: { id: round.id },
      data: {
        status: "VOTING_OPEN",
        votingOpenedAt: serverNow,
        votingClosesAt,
        votingStartedByMemberId: options.actorMemberId
      }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "VOTING_STARTED",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: {
        roundNumber: round.roundNumber,
        durationSeconds: round.votingDurationSeconds,
        optionCount,
        mode: options.mode
      }
    });

    return { votingClosesAt, optionCount };
  });
}

/**
 * Finalizar simulacion.
 *
 * Solo existe en modo TEST: permite ensayar el cierre sin esperar. En la
 * eleccion real no hay cierre anticipado.
 */
export async function finishSimulation(options: {
  electionId: string;
  roundId: string;
  actorMemberId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, "TEST");

    if (round.status !== "VOTING_OPEN") {
      throw new RoundError("La simulación no tiene una votación abierta.");
    }

    const serverNow = await databaseNow(tx);

    await tx.electionRound.update({
      where: { id: round.id },
      data: {
        status: "VOTING_CLOSED",
        votingClosedAt: serverNow,
        votingClosesAt: serverNow,
        votingClosedByMemberId: options.actorMemberId
      }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "SIMULATION_FINISHED",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: { mode: "TEST" }
    });
  });

  clearParticipationCache(options.roundId);
}

// ---------------------------------------------------------------------------
// Resultados: proceso guiado e irreversible, sin vista previa
// ---------------------------------------------------------------------------

export async function startResultsCountdown(options: {
  electionId: string;
  roundId: string;
  seconds: number;
  actorMemberId: string;
  mode: ElectionMode;
}): Promise<Date> {
  return prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, options.mode);
    const serverNow = await databaseNow(tx);

    if (!hasVotingFinished(round, serverNow)) {
      throw new RoundError("La cuenta atrás de resultados solo puede iniciarse tras cerrar la votación.");
    }
    if (round.resultsRevealStage !== "HIDDEN") {
      throw new RoundError("Los resultados ya han empezado a publicarse.");
    }
    if (round.resultsCountdownStartedAt && round.resultsRevealAt) {
      // Idempotente: no se reinicia una cuenta atras ya en marcha.
      return round.resultsRevealAt;
    }

    const resultsRevealAt = new Date(serverNow.getTime() + options.seconds * 1000);

    await tx.electionRound.update({
      where: { id: round.id },
      data: {
        status: "RESULTS_WAITING",
        votingClosedAt: round.votingClosedAt ?? round.votingClosesAt ?? serverNow,
        resultsCountdownDurationSeconds: options.seconds,
        resultsCountdownStartedAt: serverNow,
        resultsRevealAt
      }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "RESULTS_COUNTDOWN_STARTED",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: { seconds: options.seconds, mode: options.mode }
    });

    return resultsRevealAt;
  });
}

/** Publica los resultados inferiores. Idempotente e irreversible. */
export async function revealLowerRanks(options: {
  electionId: string;
  roundId: string;
  actorMemberId: string;
  mode: ElectionMode;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, options.mode);
    const serverNow = await databaseNow(tx);

    if (round.resultsRevealStage !== "HIDDEN") return; // ya publicada

    if (!hasVotingFinished(round, serverNow)) {
      throw new RoundError("La votación todavía no ha finalizado.");
    }
    if (!resultsCountdownElapsed(round, serverNow)) {
      throw new RoundError("La cuenta atrás de resultados todavía no ha terminado.");
    }

    const updated = await tx.electionRound.updateMany({
      where: { id: round.id, resultsRevealStage: "HIDDEN" },
      data: {
        status: "RESULTS_REVEALING",
        votingClosedAt: round.votingClosedAt ?? round.votingClosesAt ?? serverNow,
        resultsRevealStage: "LOWER_RANKS_REVEALED",
        lowerResultsRevealedAt: serverNow,
        lowerResultsRevealedByMemberId: options.actorMemberId
      }
    });

    if (updated.count === 0) return;

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "LOWER_RESULTS_REVEALED",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: { mode: options.mode }
    });
  });
}

export async function revealFourthAndFifth(options: {
  electionId: string;
  roundId: string;
  actorMemberId: string;
  mode: ElectionMode;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, options.mode);
    const serverNow = await databaseNow(tx);

    if (round.resultsRevealStage === "FOURTH_FIFTH_REVEALED" || round.resultsRevealStage === "PODIUM_REVEALED") {
      return;
    }
    if (round.resultsRevealStage !== "LOWER_RANKS_REVEALED") {
      throw new RoundError("Primero hay que publicar los resultados inferiores.");
    }

    const updated = await tx.electionRound.updateMany({
      where: { id: round.id, resultsRevealStage: "LOWER_RANKS_REVEALED" },
      data: {
        resultsRevealStage: "FOURTH_FIFTH_REVEALED",
        fourthFifthRevealedAt: serverNow,
        fourthFifthRevealedByMemberId: options.actorMemberId
      }
    });

    if (updated.count === 0) return;

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "FOURTH_FIFTH_REVEALED",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: { mode: options.mode }
    });
  });
}

export async function revealPodium(options: {
  electionId: string;
  roundId: string;
  actorMemberId: string;
  mode: ElectionMode;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, options.mode);
    const serverNow = await databaseNow(tx);

    if (round.resultsRevealStage === "PODIUM_REVEALED") return;
    if (round.resultsRevealStage !== "FOURTH_FIFTH_REVEALED") {
      throw new RoundError("Primero hay que publicar los puestos 4 y 5.");
    }

    const updated = await tx.electionRound.updateMany({
      where: { id: round.id, resultsRevealStage: "FOURTH_FIFTH_REVEALED" },
      data: {
        status: "RESULTS_PUBLISHED",
        resultsRevealStage: "PODIUM_REVEALED",
        podiumRevealedAt: serverNow,
        podiumRevealedByMemberId: options.actorMemberId
      }
    });

    if (updated.count === 0) return;

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "PODIUM_REVEALED",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: { mode: options.mode }
    });
  });
}

// ---------------------------------------------------------------------------
// Segunda vuelta: solo a partir de un empate YA PUBLICO
// ---------------------------------------------------------------------------

export interface RunoffAvailability {
  available: boolean;
  reason: string | null;
  tiedOptionNames: string[];
  tiedVotes: number;
}

export async function runoffAvailability(options: {
  electionId: string;
  sourceRound: ElectionRound;
  runoffExists: boolean;
  now: Date;
}): Promise<RunoffAvailability> {
  const empty = { tiedOptionNames: [] as string[], tiedVotes: 0 };

  if (options.runoffExists) {
    return { available: false, reason: "Ya existe una segunda vuelta.", ...empty };
  }
  if (options.sourceRound.roundNumber !== 1) {
    return { available: false, reason: "La segunda vuelta se crea desde la primera vuelta.", ...empty };
  }
  if (!hasVotingFinished(options.sourceRound, options.now)) {
    return { available: false, reason: "La primera vuelta todavía no está cerrada.", ...empty };
  }
  // No se decide desde una vista privada: el empate debe ser publico.
  if (options.sourceRound.resultsRevealStage !== "PODIUM_REVEALED") {
    return {
      available: false,
      reason: "El resultado de la primera vuelta todavía no es público.",
      ...empty
    };
  }

  const tally = await tallyRoundWith(prisma, options.sourceRound.id);

  if (tally.totalValidVotes === 0) {
    return {
      available: false,
      reason: "No se ha emitido ningún voto, por lo que no puede crearse una segunda vuelta.",
      ...empty
    };
  }

  const tie = detectFirstPlaceTie(tally.groups);
  if (!tie.isTie) {
    return {
      available: false,
      reason: "No hay empate en primera posición: no procede una segunda vuelta.",
      tiedOptionNames: [],
      tiedVotes: tie.votes
    };
  }

  return {
    available: true,
    reason: null,
    tiedOptionNames: tie.options.map((option) => option.memberName),
    tiedVotes: tie.votes
  };
}

export async function createRunoff(options: {
  electionId: string;
  sourceRoundId: string;
  actorMemberId: string;
  mode: ElectionMode;
}): Promise<{ roundId: string; optionCount: number }> {
  return prisma.$transaction(async (tx) => {
    await lockElectionForUpdate(tx, options.electionId);
    const sourceRound = await loadRound(tx, options.sourceRoundId, options.mode);
    const serverNow = await databaseNow(tx);

    if (sourceRound.roundNumber !== 1) {
      throw new RoundError("La segunda vuelta se crea desde la primera vuelta.");
    }
    if (!hasVotingFinished(sourceRound, serverNow)) {
      throw new RoundError("La primera vuelta todavía no está cerrada.");
    }
    if (sourceRound.resultsRevealStage !== "PODIUM_REVEALED") {
      throw new RoundError("El resultado de la primera vuelta todavía no es público.");
    }

    const alreadyExists = await tx.electionRound.findFirst({
      where: { electionId: options.electionId, roundNumber: 2 },
      select: { id: true }
    });
    if (alreadyExists) throw new RoundError("Ya existe una segunda vuelta.");

    const tally = await tallyRoundWith(tx, sourceRound.id);
    if (tally.totalValidVotes === 0) {
      throw new RoundError("No se ha emitido ningún voto, por lo que no puede crearse una segunda vuelta.");
    }

    const tie = detectFirstPlaceTie(tally.groups);
    if (!tie.isTie) {
      throw new RoundError("No hay empate en primera posición: no procede una segunda vuelta.");
    }

    const runoff = await tx.electionRound.create({
      data: {
        electionId: options.electionId,
        mode: sourceRound.mode,
        roundNumber: 2,
        sourceRoundId: sourceRound.id,
        status: "READY_TO_START"
      },
      select: { id: true }
    });

    const optionCount = await freezeRunoffOptions(tx, runoff.id, sourceRound.id);

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: runoff.id,
      actorMemberId: options.actorMemberId,
      action: "RUNOFF_CREATED",
      entityType: "ElectionRound",
      entityId: runoff.id,
      metadata: {
        sourceRoundId: sourceRound.id,
        tiedVotes: tie.votes,
        optionCount,
        mode: options.mode
      }
    });

    return { roundId: runoff.id, optionCount };
  });
}

// ---------------------------------------------------------------------------
// Reinicio: EXCLUSIVAMENTE en modo TEST
// ---------------------------------------------------------------------------

export interface ResetPreview {
  ballots: number;
  participations: number;
  options: number;
}

export async function resetPreview(roundId: string): Promise<ResetPreview> {
  const [ballots, participations, options] = await Promise.all([
    prisma.ballot.count({ where: { roundId } }),
    prisma.votingParticipation.count({ where: { roundId } }),
    prisma.roundBallotOption.count({ where: { roundId } })
  ]);
  return { ballots, participations, options };
}

/**
 * Reinicia una ronda de SIMULACION.
 *
 * Solo opera sobre rondas TEST: la comprobacion se hace en esta capa y la
 * base de datos la refuerza con disparadores que impiden borrar papeletas o
 * participaciones de una ronda LIVE.
 */
export async function resetSimulation(options: {
  electionId: string;
  roundId: string;
  actorMemberId: string;
}): Promise<ResetPreview> {
  const result = await prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, "TEST");

    const ballots = await tx.ballot.deleteMany({ where: { roundId: round.id } });
    const participations = await tx.votingParticipation.deleteMany({ where: { roundId: round.id } });
    const optionsDeleted = await tx.roundBallotOption.deleteMany({ where: { roundId: round.id } });

    await tx.electionRound.update({
      where: { id: round.id },
      data: {
        status: "READY_TO_START",
        votingOpenedAt: null,
        votingClosesAt: null,
        votingClosedAt: null,
        votingStartedByMemberId: null,
        votingClosedByMemberId: null,
        resultsCountdownDurationSeconds: null,
        resultsCountdownStartedAt: null,
        resultsRevealAt: null,
        resultsRevealStage: "HIDDEN",
        lowerResultsRevealedAt: null,
        lowerResultsRevealedByMemberId: null,
        fourthFifthRevealedAt: null,
        fourthFifthRevealedByMemberId: null,
        podiumRevealedAt: null,
        podiumRevealedByMemberId: null
      }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      roundId: round.id,
      actorMemberId: options.actorMemberId,
      action: "SIMULATION_RESET",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: {
        roundNumber: round.roundNumber,
        ballotsDeleted: ballots.count,
        participationsDeleted: participations.count,
        optionsDeleted: optionsDeleted.count,
        mode: "TEST"
      }
    });

    return {
      ballots: ballots.count,
      participations: participations.count,
      options: optionsDeleted.count
    };
  });

  clearParticipationCache(options.roundId);
  return result;
}

/** Elimina la segunda vuelta de una simulacion para poder repetir el ensayo. */
export async function deleteSimulationRunoff(options: {
  electionId: string;
  roundId: string;
  actorMemberId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await loadRound(tx, options.roundId, "TEST");
    if (round.roundNumber !== 2) {
      throw new RoundError("Solo puede eliminarse la segunda vuelta de una simulación.");
    }

    await tx.ballot.deleteMany({ where: { roundId: round.id } });
    await tx.votingParticipation.deleteMany({ where: { roundId: round.id } });
    await tx.roundBallotOption.deleteMany({ where: { roundId: round.id } });
    await tx.electionRound.delete({ where: { id: round.id } });

    await writeAudit(tx, {
      electionId: options.electionId,
      actorMemberId: options.actorMemberId,
      action: "SIMULATION_RESET",
      entityType: "ElectionRound",
      entityId: round.id,
      metadata: { deletedRunoff: true, mode: "TEST" }
    });
  });

  clearParticipationCache(options.roundId);
}

export async function updateCandidacyDeadline(options: {
  electionId: string;
  deadline: Date | null;
  actorMemberId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockElectionForUpdate(tx, options.electionId);

    await tx.election.update({
      where: { id: options.electionId },
      data: { candidacyEditDeadline: options.deadline }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      actorMemberId: options.actorMemberId,
      action: "CANDIDACY_DEADLINE_UPDATED",
      entityType: "Election",
      entityId: options.electionId,
      metadata: { deadline: options.deadline ? options.deadline.toISOString() : null }
    });
  });
}

export { canRevealLowerRanks };
