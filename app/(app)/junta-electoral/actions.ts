"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ElectionMode } from "@prisma/client";
import { requireBoardMemberOrThrow } from "@/lib/auth/current-member";
import { AuthorizationError } from "@/lib/authorization/board";
import { CandidacyError, deleteCandidacyAsBoard } from "@/lib/election/candidacy";
import { CorrectionError, requestCorrection, setReviewStatus } from "@/lib/election/corrections";
import { EligibilityError, excludeMember, reinstateMember } from "@/lib/election/eligibility";
import {
  configureVotingDuration,
  createRunoff,
  finishSimulation,
  resetSimulation,
  revealFourthAndFifth,
  revealLowerRanks,
  revealPodium,
  RoundError,
  startResultsCountdown,
  startVoting,
  updateCandidacyDeadline
} from "@/lib/election/rounds";
import { ElectionStateError, getElection, settleExpiredRounds } from "@/lib/election/state";
import { fromDateTimeLocalValue } from "@/lib/time/format";
import {
  candidacyIdSchema,
  correctionRequestSchema,
  deadlineSchema,
  durationSchema,
  electionModeSchema,
  exclusionSchema,
  firstIssueMessage,
  reinstateSchema,
  resetSchema,
  resultsCountdownSchema,
  reviewStatusSchema,
  roundActionSchema
} from "@/lib/validation/candidacy";

/**
 * Acciones administrativas.
 *
 * Todas vuelven a verificar en servidor: sesión, rol de Junta Electoral leído
 * de base de datos, modo declarado, elección, ronda y estado. Ocultar un
 * enlace o deshabilitar un botón nunca es suficiente.
 *
 * El modo viaja en la petición y se comprueba dos veces: contra la elección
 * correspondiente y, en la capa de dominio, contra el modo real de la ronda.
 * Una acción de prueba no puede operar sobre una ronda real, ni al contrario.
 */

export interface BoardActionResult {
  error: string | null;
  success: string | null;
}

const ok = (success: string): BoardActionResult => ({ error: null, success });
const fail = (error: string): BoardActionResult => ({ error, success: null });

const modeOnlySchema = z.object({ mode: electionModeSchema });

function describeError(error: unknown, fallback: string): BoardActionResult {
  if (
    error instanceof RoundError ||
    error instanceof ElectionStateError ||
    error instanceof CandidacyError ||
    error instanceof CorrectionError ||
    error instanceof EligibilityError ||
    error instanceof AuthorizationError
  ) {
    return fail(error.message);
  }
  return fail(fallback);
}

function revalidateBoard(mode: ElectionMode): void {
  revalidatePath("/junta-electoral");
  revalidatePath("/junta-electoral/candidaturas");
  revalidatePath("/junta-electoral/censo");
  revalidatePath("/junta-electoral/votacion");
  revalidatePath("/junta-electoral/resultados");
  revalidatePath("/junta-electoral/auditoria");
  revalidatePath("/junta-electoral/pruebas");
  if (mode === "LIVE") {
    revalidatePath("/eleccion");
    revalidatePath("/eleccion/comparar");
  }
}

/** Comprueba que la ronda pertenece a la elección del modo declarado. */
async function resolveRound(roundId: string, mode: ElectionMode) {
  const election = await getElection(mode);
  const round = election.rounds.find((item) => item.id === roundId);
  if (!round) {
    throw new ElectionStateError(
      mode === "TEST"
        ? "La ronda no pertenece a la elección de prueba."
        : "La ronda no pertenece a la elección real."
    );
  }
  return { election, round };
}

// ---------------------------------------------------------------------------
// Plazo de candidaturas y censo (elección real)
// ---------------------------------------------------------------------------

export async function updateDeadlineAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = deadlineSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  const deadline = parsed.data.deadline ? fromDateTimeLocalValue(parsed.data.deadline) : null;
  if (parsed.data.deadline && !deadline) return fail("La fecha límite no es válida.");

  try {
    const election = await getElection("LIVE");
    await updateCandidacyDeadline({
      electionId: election.id,
      deadline,
      actorMemberId: member.id
    });
  } catch (error) {
    return describeError(error, "No se ha podido actualizar el plazo.");
  }

  revalidateBoard("LIVE");
  revalidatePath("/presentar-candidatura");
  return ok(deadline ? "Plazo actualizado." : "Plazo eliminado.");
}

export async function excludeMemberAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = exclusionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const election = await getElection("LIVE");
    await excludeMember({
      electionId: election.id,
      memberId: parsed.data.memberId,
      reasons: parsed.data.reasons,
      actorMemberId: member.id
    });
  } catch (error) {
    return describeError(error, "No se ha podido excluir al miembro.");
  }

  revalidateBoard("LIVE");
  return ok("Miembro excluido como opción votable.");
}

export async function reinstateMemberAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = reinstateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const election = await getElection("LIVE");
    await reinstateMember({
      electionId: election.id,
      memberId: parsed.data.memberId,
      actorMemberId: member.id
    });
  } catch (error) {
    return describeError(error, "No se ha podido reincluir al miembro.");
  }

  revalidateBoard("LIVE");
  return ok("Miembro reincluido como opción votable.");
}

// ---------------------------------------------------------------------------
// Revisión de candidaturas: la Junta no edita contenido
// ---------------------------------------------------------------------------

export async function requestCorrectionAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = correctionRequestSchema.merge(modeOnlySchema).safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const election = await getElection(parsed.data.mode);
    await requestCorrection({
      electionId: election.id,
      candidacyId: parsed.data.candidacyId,
      reason: parsed.data.reason,
      actorMemberId: member.id
    });
  } catch (error) {
    return describeError(error, "No se ha podido registrar la solicitud.");
  }

  revalidateBoard(parsed.data.mode);
  revalidatePath("/presentar-candidatura");
  return ok("Corrección solicitada al candidato.");
}

export async function setReviewStatusAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = reviewStatusSchema.merge(modeOnlySchema).safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const election = await getElection(parsed.data.mode);
    await setReviewStatus({
      electionId: election.id,
      candidacyId: parsed.data.candidacyId,
      status: parsed.data.status,
      actorMemberId: member.id
    });
  } catch (error) {
    return describeError(error, "No se ha podido actualizar la revisión.");
  }

  revalidateBoard(parsed.data.mode);
  revalidatePath("/presentar-candidatura");
  return ok(
    parsed.data.status === "VALID" ? "Candidatura validada." : "Candidatura marcada como no válida."
  );
}

export async function deleteCandidacyAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = candidacyIdSchema.merge(modeOnlySchema).safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const election = await getElection(parsed.data.mode);
    await deleteCandidacyAsBoard({
      electionId: election.id,
      candidacyId: parsed.data.candidacyId,
      actorMemberId: member.id
    });
  } catch (error) {
    return describeError(error, "No se ha podido eliminar la candidatura.");
  }

  revalidateBoard(parsed.data.mode);
  return ok("Candidatura eliminada.");
}

// ---------------------------------------------------------------------------
// Votación
// ---------------------------------------------------------------------------

export async function configureDurationAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = durationSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const { election, round } = await resolveRound(parsed.data.roundId, parsed.data.mode);
    await configureVotingDuration({
      electionId: election.id,
      roundId: round.id,
      seconds: parsed.data.seconds,
      actorMemberId: member.id,
      mode: parsed.data.mode
    });
  } catch (error) {
    return describeError(error, "No se ha podido configurar la duración.");
  }

  revalidateBoard(parsed.data.mode);
  return ok("Duración configurada.");
}

export async function startVotingAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = roundActionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const { election, round } = await resolveRound(parsed.data.roundId, parsed.data.mode);
    const result = await startVoting({
      electionId: election.id,
      roundId: round.id,
      actorMemberId: member.id,
      mode: parsed.data.mode
    });

    revalidateBoard(parsed.data.mode);
    return ok(`Votación iniciada con ${result.optionCount} opciones congeladas.`);
  } catch (error) {
    return describeError(error, "No se ha podido iniciar la votación.");
  }
}

/** Solo en modo TEST: la elección real no admite cierre anticipado. */
export async function finishSimulationAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = roundActionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));
  if (parsed.data.mode !== "TEST") {
    return fail("La elección real no admite cierre anticipado: termina al alcanzar su hora de cierre.");
  }

  try {
    const { election, round } = await resolveRound(parsed.data.roundId, "TEST");
    await finishSimulation({
      electionId: election.id,
      roundId: round.id,
      actorMemberId: member.id
    });
  } catch (error) {
    return describeError(error, "No se ha podido finalizar la simulación.");
  }

  revalidateBoard("TEST");
  return ok("Simulación finalizada.");
}

export async function startResultsCountdownAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = resultsCountdownSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    await settleExpiredRounds(parsed.data.mode);
    const { election, round } = await resolveRound(parsed.data.roundId, parsed.data.mode);
    await startResultsCountdown({
      electionId: election.id,
      roundId: round.id,
      seconds: parsed.data.seconds,
      actorMemberId: member.id,
      mode: parsed.data.mode
    });
  } catch (error) {
    return describeError(error, "No se ha podido iniciar la cuenta atrás.");
  }

  revalidateBoard(parsed.data.mode);
  return ok("Cuenta atrás de resultados iniciada.");
}

// ---------------------------------------------------------------------------
// Publicación de resultados: irreversible, idempotente y sin vista previa
// ---------------------------------------------------------------------------

export async function revealLowerAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = roundActionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    await settleExpiredRounds(parsed.data.mode);
    const { election, round } = await resolveRound(parsed.data.roundId, parsed.data.mode);
    await revealLowerRanks({
      electionId: election.id,
      roundId: round.id,
      actorMemberId: member.id,
      mode: parsed.data.mode
    });
  } catch (error) {
    return describeError(error, "No se han podido publicar los resultados inferiores.");
  }

  revalidateBoard(parsed.data.mode);
  return ok("Resultados inferiores publicados.");
}

export async function revealFourthFifthAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = roundActionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const { election, round } = await resolveRound(parsed.data.roundId, parsed.data.mode);
    await revealFourthAndFifth({
      electionId: election.id,
      roundId: round.id,
      actorMemberId: member.id,
      mode: parsed.data.mode
    });
  } catch (error) {
    return describeError(error, "No se han podido publicar los puestos 4 y 5.");
  }

  revalidateBoard(parsed.data.mode);
  return ok("Puestos 4 y 5 publicados.");
}

export async function revealPodiumAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = roundActionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const { election, round } = await resolveRound(parsed.data.roundId, parsed.data.mode);
    await revealPodium({
      electionId: election.id,
      roundId: round.id,
      actorMemberId: member.id,
      mode: parsed.data.mode
    });
  } catch (error) {
    return describeError(error, "No se ha podido publicar el podio.");
  }

  revalidateBoard(parsed.data.mode);
  return ok("Podio publicado. El resultado está completo.");
}

export async function createRunoffAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = roundActionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const { election, round } = await resolveRound(parsed.data.roundId, parsed.data.mode);
    const result = await createRunoff({
      electionId: election.id,
      sourceRoundId: round.id,
      actorMemberId: member.id,
      mode: parsed.data.mode
    });

    revalidateBoard(parsed.data.mode);
    return ok(`Segunda vuelta creada con ${result.optionCount} opciones.`);
  } catch (error) {
    return describeError(error, "No se ha podido crear la segunda vuelta.");
  }
}

// ---------------------------------------------------------------------------
// Simulación: nunca acepta una ronda real
// ---------------------------------------------------------------------------

export async function resetSimulationAction(input: unknown): Promise<BoardActionResult> {
  const member = await requireBoardMemberOrThrow();
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const { election, round } = await resolveRound(parsed.data.roundId, "TEST");
    const result = await resetSimulation({
      electionId: election.id,
      roundId: round.id,
      actorMemberId: member.id
    });

    revalidateBoard("TEST");
    return ok(
      `Simulación reiniciada: ${result.ballots} papeletas y ${result.participations} participaciones eliminadas.`
    );
  } catch (error) {
    return describeError(error, "No se ha podido reiniciar la simulación.");
  }
}
