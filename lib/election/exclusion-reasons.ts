import type { ExclusionReason } from "@prisma/client";

/**
 * Motivos de exclusión.
 *
 * Módulo sin acceso a base de datos para poder usarse también en componentes
 * de cliente. Solo existen dos motivos: no hay un motivo genérico "Otros".
 */

export const EXCLUSION_REASONS: readonly ExclusionReason[] = [
  "PREVIOUS_PRESIDENT",
  "ABSENT_CHRISTMAS_DINNER"
];

export const EXCLUSION_REASON_LABELS: Record<ExclusionReason, string> = {
  PREVIOUS_PRESIDENT: "Presidente anterior",
  ABSENT_CHRISTMAS_DINNER: "Ausente de la cena"
};

export const EXCLUSION_REASON_DESCRIPTIONS: Record<ExclusionReason, string> = {
  PREVIOUS_PRESIDENT:
    "Los miembros que ya han sido presidentes no pueden volver a salir elegidos como presidente.",
  ABSENT_CHRISTMAS_DINNER:
    "Los miembros que no asistan a la cena anual de Navidad no pueden salir elegidos como presidente."
};
