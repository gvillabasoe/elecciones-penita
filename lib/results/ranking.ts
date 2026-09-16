/**
 * Ranking electoral y fases de revelacion.
 *
 * Cada opcion representa a UN MIEMBRO. Si el miembro tiene candidatura, sus
 * datos enriquecen la opcion; nunca existe una opcion adicional ni un
 * contador separado.
 *
 * Reglas:
 *  - Solo entran opciones con al menos un voto.
 *  - Ranking de competicion, equivalente a RANK(): 1, 1, 3 / 1, 2, 2, 4 /
 *    1, 1, 1, 4 / 1, 2, 3, 3, 5. Nunca DENSE_RANK().
 *  - Los empates comparten posicion y se revelan juntos.
 *  - Si un empate cruza el limite del top 5, todo el grupo queda oculto en la
 *    primera fase: un empate nunca se divide entre dos fases.
 *
 * Reparto por fases (posicion = ranking de competicion del grupo):
 *  - LOWER_RANKS_REVEALED  -> grupos con posicion >= 6
 *  - FOURTH_FIFTH_REVEALED -> grupos con posicion 4 o 5
 *  - PODIUM_REVEALED       -> grupos con posicion <= 3
 */

export type RevealStage =
  | "HIDDEN"
  | "LOWER_RANKS_REVEALED"
  | "FOURTH_FIFTH_REVEALED"
  | "PODIUM_REVEALED";

export interface TallyEntry {
  optionId: string;
  memberId: string;
  memberName: string;
  candidacyId: string | null;
  candidacyName: string | null;
  slogan: string | null;
  hasFormalCandidacy: boolean;
  color: string;
  sortOrder: number;
  votes: number;
}

export interface RankedOption extends TallyEntry {
  position: number;
  percentage: number;
}

export interface RankGroup {
  position: number;
  votes: number;
  percentage: number;
  options: RankedOption[];
}

export const NO_FORMAL_CANDIDACY_LABEL = "Sin candidatura formal";
export const FORMAL_CANDIDACY_LABEL = "Con candidatura";

export function totalVotes(entries: readonly TallyEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.votes, 0);
}

export function percentageOf(votes: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((votes / total) * 1000) / 10;
}

/**
 * Agrupa las opciones con votos en grupos de posicion, ordenados de mas a
 * menos votos. Dentro de un empate se ordena alfabeticamente SOLO para
 * distribuir visualmente: el empate no se rompe, todas comparten posicion.
 */
export function buildRankGroups(entries: readonly TallyEntry[]): RankGroup[] {
  const total = totalVotes(entries);
  const withVotes = entries.filter((entry) => entry.votes > 0);

  const byVotes = new Map<number, TallyEntry[]>();
  for (const entry of withVotes) {
    const bucket = byVotes.get(entry.votes);
    if (bucket) bucket.push(entry);
    else byVotes.set(entry.votes, [entry]);
  }

  const voteValues = [...byVotes.keys()].sort((a, b) => b - a);

  const groups: RankGroup[] = [];
  let processed = 0;

  for (const votes of voteValues) {
    const bucket = byVotes.get(votes) ?? [];
    const position = processed + 1;
    const percentage = percentageOf(votes, total);

    const options = [...bucket]
      .sort((a, b) => a.memberName.localeCompare(b.memberName, "es"))
      .map<RankedOption>((entry) => ({ ...entry, position, percentage }));

    groups.push({ position, votes, percentage, options });
    processed += bucket.length;
  }

  return groups;
}

export function podiumGroups(groups: readonly RankGroup[]): RankGroup[] {
  return groups.filter((group) => group.position <= 3);
}

export function fourthFifthGroups(groups: readonly RankGroup[]): RankGroup[] {
  return groups.filter((group) => group.position === 4 || group.position === 5);
}

export function lowerGroups(groups: readonly RankGroup[]): RankGroup[] {
  return groups.filter((group) => group.position >= 6);
}

/** Indica si la fase indicada ya permite mostrar el grupo. */
export function isGroupVisible(group: RankGroup, stage: RevealStage): boolean {
  switch (stage) {
    case "HIDDEN":
      return false;
    case "LOWER_RANKS_REVEALED":
      return group.position >= 6;
    case "FOURTH_FIFTH_REVEALED":
      return group.position >= 4;
    case "PODIUM_REVEALED":
      return true;
    default:
      return false;
  }
}

/** Grupos visibles en una fase, ordenados de menos a mas votos para animar. */
export function visibleGroupsAscending(groups: readonly RankGroup[], stage: RevealStage): RankGroup[] {
  return groups
    .filter((group) => isGroupVisible(group, stage))
    .sort((a, b) => a.votes - b.votes);
}

/** Grupos que se revelan exactamente al entrar en la fase indicada. */
export function groupsRevealedAtStage(groups: readonly RankGroup[], stage: RevealStage): RankGroup[] {
  switch (stage) {
    case "LOWER_RANKS_REVEALED":
      return lowerGroups(groups);
    case "FOURTH_FIFTH_REVEALED":
      return fourthFifthGroups(groups).sort((a, b) => b.position - a.position);
    case "PODIUM_REVEALED":
      return podiumGroups(groups).sort((a, b) => b.position - a.position);
    default:
      return [];
  }
}

export function hasFourthOrFifth(groups: readonly RankGroup[]): boolean {
  return fourthFifthGroups(groups).length > 0;
}

export function hasLowerRanks(groups: readonly RankGroup[]): boolean {
  return lowerGroups(groups).length > 0;
}

export function positionExists(groups: readonly RankGroup[], position: number): boolean {
  return groups.some((group) => group.position === position);
}

/**
 * Mensaje para una posicion que no existe por efecto del ranking de
 * competicion. Devuelve null cuando la posicion si existe.
 */
export function missingPositionMessage(
  groups: readonly RankGroup[],
  position: 2 | 3 | 4 | 5
): string | null {
  if (positionExists(groups, position)) return null;
  if (groups.length === 0) return null;

  switch (position) {
    case 2:
      return "No existe segundo puesto debido al empate en primera posición.";
    case 3:
      return positionExists(groups, 2)
        ? "No existe tercer puesto debido al empate en segunda posición."
        : "No existe tercer puesto debido al empate en primera posición.";
    case 4:
      return "No hay opciones clasificadas en cuarto puesto.";
    case 5:
      return "No hay opciones clasificadas en quinto puesto.";
    default:
      return null;
  }
}

export interface FirstPlaceTie {
  isTie: boolean;
  votes: number;
  options: RankedOption[];
}

/** Detecta empate en primera posicion con al menos un voto. */
export function detectFirstPlaceTie(groups: readonly RankGroup[]): FirstPlaceTie {
  const first = groups[0];
  if (!first || first.votes <= 0) {
    return { isTie: false, votes: 0, options: [] };
  }
  return {
    isTie: first.options.length >= 2,
    votes: first.votes,
    options: first.options
  };
}

export const NEXT_STAGE: Record<RevealStage, RevealStage | null> = {
  HIDDEN: "LOWER_RANKS_REVEALED",
  LOWER_RANKS_REVEALED: "FOURTH_FIFTH_REVEALED",
  FOURTH_FIFTH_REVEALED: "PODIUM_REVEALED",
  PODIUM_REVEALED: null
};

/** Las transiciones de fase son unidireccionales. */
export function canAdvanceTo(current: RevealStage, target: RevealStage): boolean {
  return NEXT_STAGE[current] === target;
}

export const STAGE_LABELS: Record<RevealStage, string> = {
  HIDDEN: "Resultados sin publicar",
  LOWER_RANKS_REVEALED: "Resultados inferiores publicados",
  FOURTH_FIFTH_REVEALED: "Puestos 4 y 5 publicados",
  PODIUM_REVEALED: "Resultado completo publicado"
};

export const PODIUM_COLORS: Record<1 | 2 | 3, { hex: string; label: string }> = {
  1: { hex: "#D4AF37", label: "Oro" },
  2: { hex: "#AEB6BF", label: "Plata" },
  3: { hex: "#CD7F32", label: "Bronce" }
};

export function podiumStyleFor(position: number) {
  if (position === 1 || position === 2 || position === 3) return PODIUM_COLORS[position];
  return null;
}

export function positionLabel(position: number): string {
  return `${position}.º`;
}

/** Etiqueta de la opcion segun tenga o no candidatura formal. */
export function candidacyLabel(entry: Pick<TallyEntry, "hasFormalCandidacy">): string {
  return entry.hasFormalCandidacy ? FORMAL_CANDIDACY_LABEL : NO_FORMAL_CANDIDACY_LABEL;
}
