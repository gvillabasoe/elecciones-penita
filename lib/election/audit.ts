import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Auditoria administrativa.
 *
 * Nunca se registra: contrasenas, hashes, identidad ligada a una papeleta,
 * opcion votada por un miembro, contenido individual de una papeleta, IP
 * ni identificador de sesion.
 */

export interface AuditInput {
  electionId: string;
  roundId?: string | null;
  actorMemberId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

type Client = Prisma.TransactionClient | typeof prisma;

export async function writeAudit(client: Client, input: AuditInput): Promise<void> {
  await client.electionAuditLog.create({
    data: {
      electionId: input.electionId,
      roundId: input.roundId ?? null,
      actorMemberId: input.actorMemberId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined
    }
  });
}

export const AUDIT_LABELS: Record<AuditAction, string> = {
  CANDIDACY_DEADLINE_UPDATED: "Plazo de candidaturas actualizado",
  CANDIDACY_CREATED: "Candidatura presentada",
  CANDIDACY_UPDATED_BY_BOARD: "Candidatura editada por la Junta (histórico)",
  CANDIDACY_DELETED: "Candidatura eliminada",
  MEMBER_EXCLUDED: "Miembro excluido",
  MEMBER_REINSTATED: "Miembro reincluido",
  VOTING_DURATION_CONFIGURED: "Duración de la votación configurada",
  VOTING_STARTED: "Votación iniciada",
  VOTING_CLOSED_MANUALLY: "Votación cerrada manualmente (histórico)",
  RESULTS_COUNTDOWN_STARTED: "Cuenta atrás de resultados iniciada",
  LOWER_RESULTS_REVEALED: "Resultados generales revelados",
  FOURTH_FIFTH_REVEALED: "Puestos 4 y 5 revelados",
  PODIUM_REVEALED: "Podio revelado",
  RUNOFF_CREATED: "Segunda vuelta creada",
  ROUND_RESET: "Ronda reiniciada (histórico)",
  CORRECTION_REQUESTED: "Corrección solicitada al candidato",
  CORRECTION_RESOLVED: "Corrección resuelta por el candidato",
  CANDIDACY_MARKED_VALID: "Candidatura validada",
  CANDIDACY_MARKED_INVALID: "Candidatura marcada como no válida",
  SIMULATION_RESET: "Simulación reiniciada",
  SIMULATION_FINISHED: "Simulación finalizada"
};
