"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMemberOrThrow } from "@/lib/auth/current-member";
import { prisma } from "@/lib/db/prisma";
import {
  candidacyEditPermission,
  CandidacyError,
  saveCandidacy
} from "@/lib/election/candidacy";
import { countOpenCorrections } from "@/lib/election/corrections";
import { isMemberEligible } from "@/lib/election/eligibility";
import { findRound, getElection, serverNow } from "@/lib/election/state";
import { candidacySchema, firstIssueMessage } from "@/lib/validation/candidacy";

export interface CandidacyActionState {
  error: string | null;
  success: string | null;
  candidacyId: string | null;
}

const payloadSchema = z.object({ data: candidacySchema });

/**
 * Presenta o actualiza la PROPIA candidatura.
 *
 * El presidente se toma siempre de la sesion. La Junta Electoral no edita
 * candidaturas: solicita correcciones y el candidato realiza el cambio.
 */
export async function saveCandidacyAction(input: unknown): Promise<CandidacyActionState> {
  const member = await requireMemberOrThrow();

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error), success: null, candidacyId: null };
  }

  const election = await getElection("LIVE");
  const firstRound = findRound(election.rounds, 1);
  if (!firstRound) {
    return { error: "La elección no tiene primera vuelta configurada.", success: null, candidacyId: null };
  }

  const [eligible, existing, now] = await Promise.all([
    isMemberEligible(election.id, member.id),
    prisma.candidacy.findFirst({
      where: { electionId: election.id, presidentId: member.id, isDeleted: false },
      select: { id: true }
    }),
    serverNow()
  ]);

  if (!existing && !eligible) {
    return {
      error: "Has sido excluido como opción votable: no puedes presentar una candidatura.",
      success: null,
      candidacyId: null
    };
  }

  const openCorrections = existing ? await countOpenCorrections(existing.id) : 0;

  const permission = candidacyEditPermission({
    election,
    firstRound,
    isOwner: true,
    isEligible: eligible,
    isDeleted: false,
    hasOpenCorrection: openCorrections > 0,
    now
  });

  if (!permission.canEdit) {
    return { error: permission.reason, success: null, candidacyId: null };
  }

  try {
    const result = await saveCandidacy({
      electionId: election.id,
      presidentId: member.id,
      input: parsed.data.data
    });

    revalidatePath("/presentar-candidatura");
    revalidatePath("/eleccion");
    revalidatePath("/eleccion/comparar");
    revalidatePath("/junta-electoral/candidaturas");
    revalidatePath(`/candidaturas/${result.candidacyId}`);

    return {
      error: null,
      success: result.created
        ? "Candidatura presentada correctamente."
        : result.correctionsResolved > 0
          ? "Cambios guardados. La corrección solicitada queda resuelta y pendiente de revisión."
          : "Los cambios se han guardado correctamente.",
      candidacyId: result.candidacyId
    };
  } catch (error) {
    if (error instanceof CandidacyError) {
      return { error: error.message, success: null, candidacyId: null };
    }
    return {
      error: "No se ha podido guardar la candidatura. Vuelve a intentarlo.",
      success: null,
      candidacyId: null
    };
  }
}
