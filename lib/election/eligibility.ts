import type { ExclusionReason, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAudit } from "@/lib/election/audit";
import { lockRoundForUpdate } from "@/lib/election/lock";

/** Exclusiones electorales y reinclusiones. */

export class EligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EligibilityError";
  }
}

export {
  EXCLUSION_REASONS,
  EXCLUSION_REASON_LABELS,
  EXCLUSION_REASON_DESCRIPTIONS
} from "@/lib/election/exclusion-reasons";

export interface MemberEligibility {
  memberId: string;
  displayName: string;
  slug: string;
  sortOrder: number;
  isEligible: boolean;
  reasons: ExclusionReason[];
  excludedAt: Date | null;
  excludedByName: string | null;
  candidacyId: string | null;
  candidacyName: string | null;
}

export async function listEligibility(electionId: string): Promise<MemberEligibility[]> {
  const [members, eligibilities, candidacies] = await Promise.all([
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, displayName: true, slug: true, sortOrder: true }
    }),
    prisma.electionEligibility.findMany({
      where: { electionId },
      include: {
        reasons: true,
        excludedBy: { select: { displayName: true } }
      }
    }),
    prisma.candidacy.findMany({
      where: { electionId, isDeleted: false },
      select: { id: true, name: true, presidentId: true }
    })
  ]);

  const eligibilityByMember = new Map(eligibilities.map((row) => [row.memberId, row]));
  const candidacyByPresident = new Map(candidacies.map((row) => [row.presidentId, row]));

  return members.map((member) => {
    const eligibility = eligibilityByMember.get(member.id);
    const candidacy = candidacyByPresident.get(member.id);
    return {
      memberId: member.id,
      displayName: member.displayName,
      slug: member.slug,
      sortOrder: member.sortOrder,
      isEligible: eligibility ? eligibility.isEligible : true,
      reasons: eligibility ? eligibility.reasons.map((reason) => reason.reason) : [],
      excludedAt: eligibility?.excludedAt ?? null,
      excludedByName: eligibility?.excludedBy?.displayName ?? null,
      candidacyId: candidacy?.id ?? null,
      candidacyName: candidacy?.name ?? null
    };
  });
}

export async function isMemberEligible(electionId: string, memberId: string): Promise<boolean> {
  const eligibility = await prisma.electionEligibility.findUnique({
    where: { electionId_memberId: { electionId, memberId } },
    select: { isEligible: true }
  });
  return eligibility ? eligibility.isEligible : true;
}

async function assertBeforeVoting(tx: Prisma.TransactionClient, electionId: string): Promise<void> {
  const firstRound = await tx.electionRound.findFirst({
    where: { electionId, roundNumber: 1 },
    select: { id: true, status: true }
  });

  if (!firstRound) throw new EligibilityError("La elección no tiene primera vuelta configurada.");

  await lockRoundForUpdate(tx, firstRound.id);

  const refreshed = await tx.electionRound.findUnique({
    where: { id: firstRound.id },
    select: { status: true }
  });

  if (!refreshed || refreshed.status !== "READY_TO_START") {
    throw new EligibilityError(
      "La votación ya ha comenzado: la papeleta está congelada y no se pueden cambiar las exclusiones."
    );
  }
}

export async function excludeMember(options: {
  electionId: string;
  memberId: string;
  reasons: ExclusionReason[];
  actorMemberId: string;
}): Promise<void> {
  if (options.reasons.length === 0) {
    throw new EligibilityError("Toda exclusión debe tener al menos un motivo.");
  }

  const uniqueReasons = [...new Set(options.reasons)];

  await prisma.$transaction(async (tx) => {
    await assertBeforeVoting(tx, options.electionId);

    const now = new Date();
    const eligibility = await tx.electionEligibility.upsert({
      where: { electionId_memberId: { electionId: options.electionId, memberId: options.memberId } },
      create: {
        electionId: options.electionId,
        memberId: options.memberId,
        isEligible: false,
        excludedByMemberId: options.actorMemberId,
        excludedAt: now,
        reinstatedByMemberId: null,
        reinstatedAt: null
      },
      update: {
        isEligible: false,
        excludedByMemberId: options.actorMemberId,
        excludedAt: now,
        reinstatedByMemberId: null,
        reinstatedAt: null
      },
      select: { id: true }
    });

    await tx.electionExclusionReason.deleteMany({ where: { eligibilityId: eligibility.id } });
    await tx.electionExclusionReason.createMany({
      data: uniqueReasons.map((reason) => ({ eligibilityId: eligibility.id, reason }))
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      actorMemberId: options.actorMemberId,
      action: "MEMBER_EXCLUDED",
      entityType: "Member",
      entityId: options.memberId,
      metadata: { reasons: uniqueReasons }
    });
  });
}

export async function reinstateMember(options: {
  electionId: string;
  memberId: string;
  actorMemberId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertBeforeVoting(tx, options.electionId);

    const eligibility = await tx.electionEligibility.findUnique({
      where: { electionId_memberId: { electionId: options.electionId, memberId: options.memberId } },
      select: { id: true, isEligible: true }
    });

    if (!eligibility || eligibility.isEligible) return;

    await tx.electionExclusionReason.deleteMany({ where: { eligibilityId: eligibility.id } });
    await tx.electionEligibility.update({
      where: { id: eligibility.id },
      data: {
        isEligible: true,
        reinstatedByMemberId: options.actorMemberId,
        reinstatedAt: new Date()
      }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      actorMemberId: options.actorMemberId,
      action: "MEMBER_REINSTATED",
      entityType: "Member",
      entityId: options.memberId
    });
  });
}
