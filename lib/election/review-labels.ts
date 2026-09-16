import type { CandidacyReviewStatus } from "@prisma/client";

/**
 * Etiquetas de revision de candidatura.
 *
 * Modulo sin acceso a base de datos para poder compartirse con la pantalla de
 * revision de la Junta Electoral, que es un componente de cliente.
 */

export const REVIEW_STATUS_LABELS: Record<CandidacyReviewStatus, string> = {
  PENDING_REVIEW: "Pendiente de revisión",
  VALID: "Validada",
  CORRECTION_REQUESTED: "Pendiente de corrección",
  INVALID: "No válida"
};

export const REVIEW_STATUS_DESCRIPTIONS: Record<CandidacyReviewStatus, string> = {
  PENDING_REVIEW: "La Junta Electoral todavía no la ha revisado.",
  VALID: "Revisada y aceptada por la Junta Electoral.",
  CORRECTION_REQUESTED: "La Junta ha solicitado una corrección al candidato.",
  INVALID: "Declarada no válida: no aparecerá como candidatura en la papeleta."
};
