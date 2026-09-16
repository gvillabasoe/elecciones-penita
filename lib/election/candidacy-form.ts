import type { ProposalType } from "@prisma/client";
import type { CandidacyWithDetails } from "@/lib/election/candidacy";
import { toCalendarInputValue } from "@/lib/time/format";

/**
 * Valores del formulario de candidatura.
 *
 * Modulo sin acceso a base de datos (las referencias a Prisma son de tipo)
 * para poder compartirse entre servidor y cliente. Las fechas son cadenas
 * "YYYY-MM-DD": fechas de calendario sin hora y sin desplazamiento.
 */

export interface SingleSectionValues {
  place: string;
  startDate: string;
  description: string;
}

export interface RangeSectionValues extends SingleSectionValues {
  endDate: string;
}

export interface CandidacyFormValues {
  name: string;
  slogan: string;
  annualGroupPlan: SingleSectionValues & { title: string };
  semanaGrandeDinner: SingleSectionValues;
  christmasDinner: SingleSectionValues;
  party: SingleSectionValues | null;
  event: SingleSectionValues | null;
  ruralHouse: RangeSectionValues | null;
  trip: RangeSectionValues | null;
  weekendGetaway: RangeSectionValues | null;
  promises: string[];
}

const EMPTY_SINGLE: SingleSectionValues = { place: "", startDate: "", description: "" };

/** Convierte las filas guardadas en los valores iniciales del formulario. */
export function toFormValues(candidacy: CandidacyWithDetails): CandidacyFormValues {
  const byType = new Map<ProposalType, CandidacyWithDetails["proposals"][number]>(
    candidacy.proposals.map((proposal) => [proposal.type, proposal])
  );

  const single = (type: ProposalType): SingleSectionValues | null => {
    const row = byType.get(type);
    if (!row) return null;
    return {
      place: row.place,
      startDate: toCalendarInputValue(row.startDate),
      description: row.description
    };
  };

  const range = (type: ProposalType): RangeSectionValues | null => {
    const row = byType.get(type);
    if (!row) return null;
    return {
      place: row.place,
      startDate: toCalendarInputValue(row.startDate),
      endDate: toCalendarInputValue(row.endDate),
      description: row.description
    };
  };

  const annual = byType.get("ANNUAL_GROUP_PLAN");

  return {
    name: candidacy.name,
    slogan: candidacy.slogan,
    annualGroupPlan: {
      title: annual?.title ?? "",
      place: annual?.place ?? "",
      startDate: toCalendarInputValue(annual?.startDate ?? null),
      description: annual?.description ?? ""
    },
    semanaGrandeDinner: single("SEMANA_GRANDE_DINNER") ?? EMPTY_SINGLE,
    christmasDinner: single("CHRISTMAS_DINNER") ?? EMPTY_SINGLE,
    party: single("PARTY"),
    event: single("EVENT"),
    ruralHouse: range("RURAL_HOUSE"),
    trip: range("TRIP"),
    weekendGetaway: range("WEEKEND_GETAWAY"),
    promises: candidacy.promises.map((promise) => promise.text)
  };
}
