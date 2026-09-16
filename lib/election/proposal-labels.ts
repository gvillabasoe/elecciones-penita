import type { ProposalType } from "@prisma/client";

/**
 * Etiquetas y orden de las propuestas.
 *
 * Modulo sin acceso a base de datos para poder compartirse con los
 * componentes de cliente (papeleta, comparador y fichas).
 */

export const PROPOSAL_LABELS: Record<ProposalType, string> = {
  ANNUAL_GROUP_PLAN: "Plan de grupo anual",
  SEMANA_GRANDE_DINNER: "Cena de la Semana Grande de Bilbao",
  CHRISTMAS_DINNER: "Cena de Navidad",
  PARTY: "Fiesta",
  EVENT: "Evento",
  RURAL_HOUSE: "Casa Rural",
  TRIP: "Viaje",
  WEEKEND_GETAWAY: "Escapada de fin de semana"
};

/** Orden fijo de categorias, identico en la ficha y en el comparador. */
export const PROPOSAL_ORDER: ProposalType[] = [
  "ANNUAL_GROUP_PLAN",
  "SEMANA_GRANDE_DINNER",
  "CHRISTMAS_DINNER",
  "PARTY",
  "EVENT",
  "RURAL_HOUSE",
  "TRIP",
  "WEEKEND_GETAWAY"
];

export const RANGE_PROPOSAL_TYPES: ProposalType[] = ["RURAL_HOUSE", "TRIP", "WEEKEND_GETAWAY"];

export const NOT_INCLUDED_LABEL = "No incluida en esta candidatura.";
