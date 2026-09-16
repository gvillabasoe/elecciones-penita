import type { CandidacyReviewStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAudit } from "@/lib/election/audit";

/**
 * Revision de candidaturas.
 *
 * La Junta Electoral NO edita el contenido redactado por un candidato: revisa,
 * solicita correcciones motivadas y, cuando las reglas lo permiten, marca la
 * candidatura como no valida o la elimina. El cambio material lo hace siempre
 * el propio candidato.
 */

export class CorrectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorrectionError";
  }
}

export {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_DESCRIPTIONS
} from "@/lib/election/review-labels";

async function assertBeforeVoting(tx: Prisma.TransactionClient, electionId: string): Promise<void> {
  const firstRound = await tx.electionRound.findFirst({
    where: { electionId, roundNumber: 1 },
    select: { status: true }
  });

  if (!firstRound || firstRound.status !== "READY_TO_START") {
    throw new CorrectionError("La votación ya ha comenzado: las candidaturas están congeladas.");
  }
}

/** Solicita una correccion motivada al candidato. */
export async function requestCorrection(options: {
  electionId: string;
  candidacyId: string;
  reason: string;
  actorMemberId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertBeforeVoting(tx, options.electionId);

    const candidacy = await tx.candidacy.findUnique({
      where: { id: options.candidacyId },
      select: { id: true, electionId: true, isDeleted: true }
    });

    if (!candidacy || candidacy.electionId !== options.electionId) {
      throw new CorrectionError("La candidatura no existe.");
    }
    if (candidacy.isDeleted) {
      throw new CorrectionError("La candidatura ha sido eliminada.");
    }

    await tx.candidacyCorrectionRequest.create({
      data: {
        candidacyId: candidacy.id,
        requestedByMemberId: options.actorMemberId,
        reason: options.reason
      }
    });

    await tx.candidacy.update({
      where: { id: candidacy.id },
      data: { reviewStatus: "CORRECTION_REQUESTED" }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      actorMemberId: options.actorMemberId,
      action: "CORRECTION_REQUESTED",
      entityType: "Candidacy",
      entityId: candidacy.id
    });
  });
}

/** Marca la revision de una candidatura. No modifica su contenido. */
export async function setReviewStatus(options: {
  electionId: string;
  candidacyId: string;
  status: Extract<CandidacyReviewStatus, "VALID" | "INVALID">;
  actorMemberId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertBeforeVoting(tx, options.electionId);

    const candidacy = await tx.candidacy.findUnique({
      where: { id: options.candidacyId },
      select: { id: true, electionId: true, isDeleted: true }
    });

    if (!candidacy || candidacy.electionId !== options.electionId) {
      throw new CorrectionError("La candidatura no existe.");
    }
    if (candidacy.isDeleted) {
      throw new CorrectionError("La candidatura ha sido eliminada.");
    }

    await tx.candidacy.update({
      where: { id: candidacy.id },
      data: { reviewStatus: options.status }
    });

    if (options.status === "VALID") {
      await tx.candidacyCorrectionRequest.updateMany({
        where: { candidacyId: candidacy.id, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByMemberId: options.actorMemberId }
      });
    }

    await writeAudit(tx, {
      electionId: options.electionId,
      actorMemberId: options.actorMemberId,
      action: options.status === "VALID" ? "CANDIDACY_MARKED_VALID" : "CANDIDACY_MARKED_INVALID",
      entityType: "Candidacy",
      entityId: candidacy.id
    });
  });
}

export interface CorrectionRequestView {
  id: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  requestedByName: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export async function listCorrectionRequests(candidacyId: string): Promise<CorrectionRequestView[]> {
  const rows = await prisma.candidacyCorrectionRequest.findMany({
    where: { candidacyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      requestedBy: { select: { displayName: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    status: row.status,
    requestedByName: row.requestedBy.displayName,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt
  }));
}

export async function countOpenCorrections(candidacyId: string): Promise<number> {
  return prisma.candidacyCorrectionRequest.count({
    where: { candidacyId, status: "OPEN" }
  });
}
