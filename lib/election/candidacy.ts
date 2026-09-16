import type { ElectionRound, Prisma, ProposalType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAudit } from "@/lib/election/audit";
import { candidacyPeriodOpen } from "@/lib/election/state";
import { generateDistinctPastel } from "@/lib/theme/pastel";
import { parseCalendarDate } from "@/lib/time/format";
import type { CandidacyInput } from "@/lib/validation/candidacy";

/**
 * Gestion de candidaturas.
 *
 * La candidatura no es una opcion de voto: enriquece la opcion del miembro que
 * la presenta. Solo su presidente puede redactar y modificar su contenido; la
 * Junta Electoral revisa y solicita correcciones, pero no edita.
 */

export class CandidacyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidacyError";
  }
}

import {
  NOT_INCLUDED_LABEL,
  PROPOSAL_LABELS,
  PROPOSAL_ORDER,
  RANGE_PROPOSAL_TYPES
} from "@/lib/election/proposal-labels";

// Se importan (se usan en los mensajes de validacion) y se reexportan para
// que el resto del codigo pueda seguir tomandolos de este modulo.
export { NOT_INCLUDED_LABEL, PROPOSAL_LABELS, PROPOSAL_ORDER, RANGE_PROPOSAL_TYPES };

const candidacyInclude = {
  president: { select: { id: true, displayName: true, slug: true } },
  proposals: { orderBy: { sortOrder: "asc" } },
  promises: { orderBy: { sortOrder: "asc" } },
  correctionRequests: {
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, createdAt: true }
  }
} satisfies Prisma.CandidacyInclude;

export type CandidacyWithDetails = Prisma.CandidacyGetPayload<{ include: typeof candidacyInclude }>;

/** Candidaturas visibles para los miembros. */
export async function listCandidacies(electionId: string): Promise<CandidacyWithDetails[]> {
  return prisma.candidacy.findMany({
    where: { electionId, isDeleted: false },
    include: candidacyInclude,
    orderBy: { createdAt: "asc" }
  });
}

/** Candidaturas comparables: activas, visibles y validas para la eleccion. */
export async function listComparableCandidacies(electionId: string): Promise<CandidacyWithDetails[]> {
  return prisma.candidacy.findMany({
    where: { electionId, isDeleted: false, reviewStatus: { not: "INVALID" } },
    include: candidacyInclude,
    orderBy: { createdAt: "asc" }
  });
}

export async function listCandidaciesForBoard(electionId: string): Promise<CandidacyWithDetails[]> {
  return prisma.candidacy.findMany({
    where: { electionId },
    include: candidacyInclude,
    orderBy: [{ isDeleted: "asc" }, { createdAt: "asc" }]
  });
}

export async function getCandidacy(candidacyId: string): Promise<CandidacyWithDetails | null> {
  return prisma.candidacy.findUnique({ where: { id: candidacyId }, include: candidacyInclude });
}

export async function getOwnCandidacy(
  electionId: string,
  presidentId: string
): Promise<CandidacyWithDetails | null> {
  return prisma.candidacy.findFirst({
    where: { electionId, presidentId, isDeleted: false },
    include: candidacyInclude
  });
}

export interface EditPermission {
  canEdit: boolean;
  reason: string | null;
}

/**
 * Reglas de edicion.
 *
 * Solo el presidente de la candidatura puede editar su contenido. La Junta
 * Electoral no edita: solicita correcciones. Si existe una solicitud abierta,
 * el candidato puede corregir aunque el plazo ordinario haya terminado,
 * siempre antes de iniciar la votacion.
 */
export function candidacyEditPermission(options: {
  election: { candidacyEditDeadline: Date | null };
  firstRound: ElectionRound;
  isOwner: boolean;
  isEligible: boolean;
  isDeleted: boolean;
  hasOpenCorrection: boolean;
  now: Date;
}): EditPermission {
  if (options.isDeleted) {
    return { canEdit: false, reason: "Esta candidatura ha sido eliminada." };
  }

  if (options.firstRound.status !== "READY_TO_START") {
    return { canEdit: false, reason: "La votación ya ha comenzado. Las candidaturas están congeladas." };
  }

  if (!options.isOwner) {
    return {
      canEdit: false,
      reason: "Solo la persona que presenta la candidatura puede editar su contenido."
    };
  }

  if (!options.isEligible) {
    return { canEdit: false, reason: "Has sido excluido como opción votable en esta elección." };
  }

  if (options.hasOpenCorrection) {
    return { canEdit: true, reason: null };
  }

  if (!candidacyPeriodOpen(options.election, options.firstRound, options.now)) {
    return { canEdit: false, reason: "El plazo para editar candidaturas ha finalizado." };
  }

  return { canEdit: true, reason: null };
}

interface ProposalRow {
  type: ProposalType;
  title: string | null;
  place: string;
  startDate: Date | null;
  endDate: Date | null;
  description: string;
  sortOrder: number;
}

function requireDate(value: string, label: string): Date {
  const parsed = parseCalendarDate(value);
  if (!parsed) throw new CandidacyError(`${label}: la fecha no es válida.`);
  return parsed;
}

/** Convierte la entrada validada en filas de propuesta. */
export function buildProposalRows(input: CandidacyInput): ProposalRow[] {
  const rows: ProposalRow[] = [];
  let sortOrder = 0;

  const push = (row: Omit<ProposalRow, "sortOrder">) => {
    sortOrder += 1;
    rows.push({ ...row, sortOrder });
  };

  push({
    type: "ANNUAL_GROUP_PLAN",
    title: input.annualGroupPlan.title,
    place: input.annualGroupPlan.place,
    startDate: requireDate(input.annualGroupPlan.startDate, PROPOSAL_LABELS.ANNUAL_GROUP_PLAN),
    endDate: null,
    description: input.annualGroupPlan.description
  });

  push({
    type: "SEMANA_GRANDE_DINNER",
    title: null,
    place: input.semanaGrandeDinner.place,
    startDate: requireDate(input.semanaGrandeDinner.startDate, PROPOSAL_LABELS.SEMANA_GRANDE_DINNER),
    endDate: null,
    description: input.semanaGrandeDinner.description
  });

  push({
    type: "CHRISTMAS_DINNER",
    title: null,
    place: input.christmasDinner.place,
    startDate: requireDate(input.christmasDinner.startDate, PROPOSAL_LABELS.CHRISTMAS_DINNER),
    endDate: null,
    description: input.christmasDinner.description
  });

  const singles: Array<[ProposalType, CandidacyInput["party"]]> = [
    ["PARTY", input.party],
    ["EVENT", input.event]
  ];

  for (const [type, value] of singles) {
    if (!value) continue;
    push({
      type,
      title: null,
      place: value.place,
      startDate: requireDate(value.startDate, PROPOSAL_LABELS[type]),
      endDate: null,
      description: value.description
    });
  }

  const ranges: Array<[ProposalType, CandidacyInput["ruralHouse"]]> = [
    ["RURAL_HOUSE", input.ruralHouse],
    ["TRIP", input.trip],
    ["WEEKEND_GETAWAY", input.weekendGetaway]
  ];

  for (const [type, value] of ranges) {
    if (!value) continue;
    const startDate = requireDate(value.startDate, PROPOSAL_LABELS[type]);
    const endDate = requireDate(value.endDate, PROPOSAL_LABELS[type]);
    if (endDate < startDate) {
      throw new CandidacyError(`${PROPOSAL_LABELS[type]}: la fecha final no puede ser anterior a la inicial.`);
    }
    push({ type, title: null, place: value.place, startDate, endDate, description: value.description });
  }

  return rows;
}

export function buildPromiseRows(input: CandidacyInput): { text: string; sortOrder: number }[] {
  const promises = (input.promises ?? []).map((text) => text.trim()).filter((text) => text.length > 0);
  return promises.map((text, index) => ({ text, sortOrder: index + 1 }));
}

export interface SaveCandidacyOptions {
  electionId: string;
  presidentId: string;
  input: CandidacyInput;
}

export interface SaveCandidacyResult {
  candidacyId: string;
  created: boolean;
  correctionsResolved: number;
}

/**
 * Crea o actualiza una candidatura de forma atomica.
 *
 * El presidente siempre procede de la sesion. Si habia solicitudes de
 * correccion abiertas, se marcan resueltas y la candidatura vuelve a quedar
 * pendiente de revision.
 */
export async function saveCandidacy(options: SaveCandidacyOptions): Promise<SaveCandidacyResult> {
  const proposals = buildProposalRows(options.input);
  const promises = buildPromiseRows(options.input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.candidacy.findFirst({
      where: { electionId: options.electionId, presidentId: options.presidentId, isDeleted: false },
      select: { id: true }
    });

    let candidacyId: string;
    let created = false;
    let correctionsResolved = 0;

    if (existing) {
      candidacyId = existing.id;
      await tx.candidacy.update({
        where: { id: candidacyId },
        data: {
          name: options.input.name,
          slogan: options.input.slogan,
          reviewStatus: "PENDING_REVIEW"
        }
      });
      await tx.candidacyProposal.deleteMany({ where: { candidacyId } });
      await tx.candidacyPromise.deleteMany({ where: { candidacyId } });

      const resolved = await tx.candidacyCorrectionRequest.updateMany({
        where: { candidacyId, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByMemberId: options.presidentId }
      });
      correctionsResolved = resolved.count;
    } else {
      const usedColors = await tx.candidacy.findMany({
        where: { electionId: options.electionId },
        select: { pastelColor: true }
      });
      const pastelColor = generateDistinctPastel(usedColors.map((row) => row.pastelColor));

      const candidacy = await tx.candidacy.create({
        data: {
          electionId: options.electionId,
          presidentId: options.presidentId,
          name: options.input.name,
          slogan: options.input.slogan,
          pastelColor
        },
        select: { id: true }
      });
      candidacyId = candidacy.id;
      created = true;
    }

    if (proposals.length > 0) {
      await tx.candidacyProposal.createMany({
        data: proposals.map((row) => ({ ...row, candidacyId }))
      });
    }

    if (promises.length > 0) {
      await tx.candidacyPromise.createMany({
        data: promises.map((row) => ({ ...row, candidacyId }))
      });
    }

    if (created) {
      await writeAudit(tx, {
        electionId: options.electionId,
        actorMemberId: options.presidentId,
        action: "CANDIDACY_CREATED",
        entityType: "Candidacy",
        entityId: candidacyId,
        metadata: { proposals: proposals.length, promises: promises.length }
      });
    }

    if (correctionsResolved > 0) {
      await writeAudit(tx, {
        electionId: options.electionId,
        actorMemberId: options.presidentId,
        action: "CORRECTION_RESOLVED",
        entityType: "Candidacy",
        entityId: candidacyId,
        metadata: { resolved: correctionsResolved }
      });
    }

    return { candidacyId, created, correctionsResolved };
  });
}

/** Eliminacion (marcado) de una candidatura por la Junta, antes de la votacion. */
export async function deleteCandidacyAsBoard(options: {
  electionId: string;
  candidacyId: string;
  actorMemberId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const firstRound = await tx.electionRound.findFirst({
      where: { electionId: options.electionId, roundNumber: 1 },
      select: { status: true }
    });

    if (!firstRound || firstRound.status !== "READY_TO_START") {
      throw new CandidacyError("No se pueden eliminar candidaturas después de iniciar la votación.");
    }

    const candidacy = await tx.candidacy.findUnique({
      where: { id: options.candidacyId },
      select: { id: true, electionId: true, isDeleted: true }
    });

    if (!candidacy || candidacy.electionId !== options.electionId) {
      throw new CandidacyError("La candidatura no existe.");
    }
    if (candidacy.isDeleted) return;

    await tx.candidacy.update({
      where: { id: candidacy.id },
      data: { isDeleted: true, deletedAt: new Date(), deletedByMemberId: options.actorMemberId }
    });

    await writeAudit(tx, {
      electionId: options.electionId,
      actorMemberId: options.actorMemberId,
      action: "CANDIDACY_DELETED",
      entityType: "Candidacy",
      entityId: candidacy.id
    });
  });
}
