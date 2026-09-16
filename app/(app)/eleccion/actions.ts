"use server";

import { revalidatePath } from "next/cache";
import { requireMemberOrThrow } from "@/lib/auth/current-member";
import { getElection, isVotingOpen, serverNow, settleExpiredRounds } from "@/lib/election/state";
import { firstIssueMessage, voteSchema } from "@/lib/validation/candidacy";
import { castVote, VoteError } from "@/lib/voting/vote";

/**
 * Emision del voto.
 *
 * Solo acepta rondas de la eleccion REAL: las rondas de prueba se operan
 * exclusivamente desde la Junta Electoral. La hora la decide PostgreSQL.
 */
export async function castVoteAction(input: unknown): Promise<{ error: string | null }> {
  const member = await requireMemberOrThrow();

  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  await settleExpiredRounds("LIVE");

  const election = await getElection("LIVE");
  const round = election.rounds.find((item) => item.id === parsed.data.roundId);
  if (!round) return { error: "La ronda no pertenece a la elección." };

  const now = await serverNow();
  if (!isVotingOpen(round, now)) return { error: "La votación no está abierta." };

  try {
    await castVote({
      roundId: round.id,
      memberId: member.id,
      optionId: parsed.data.optionId
    });
  } catch (error) {
    if (error instanceof VoteError) return { error: error.message };
    return { error: "No se ha podido registrar el voto. Vuelve a intentarlo." };
  }

  revalidatePath("/eleccion");
  return { error: null };
}
