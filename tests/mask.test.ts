import { describe, expect, it } from "vitest";
import { buildRankGroups, totalVotes, type RevealStage, type TallyEntry } from "@/lib/results/ranking";
import { maskResults } from "@/lib/results/mask";

function entry(memberName: string, votes: number, sortOrder: number): TallyEntry {
  return {
    optionId: `opcion-${sortOrder}`,
    memberId: `miembro-${sortOrder}`,
    memberName,
    candidacyId: null,
    candidacyName: null,
    slogan: null,
    hasFormalCandidacy: false,
    color: "#CFDDE3",
    sortOrder,
    votes
  };
}

const ENTRIES = [
  entry("Primero", 10, 1),
  entry("Segundo", 8, 2),
  entry("Tercero", 6, 3),
  entry("Cuarto", 4, 4),
  entry("Quinto", 3, 5),
  entry("Sexto", 2, 6),
  entry("Septimo", 1, 7)
];

function mask(stage: RevealStage, entries: TallyEntry[] = ENTRIES) {
  return maskResults({
    roundId: "ronda",
    roundNumber: 1,
    stage,
    groups: buildRankGroups(entries),
    totalValidVotes: totalVotes(entries),
    participationCount: totalVotes(entries),
    ballotCount: totalVotes(entries)
  });
}

describe("mascara de resultados", () => {
  it("no envia ningun dato mientras la fase esta oculta", () => {
    const result = mask("HIDDEN");

    expect(result.groups).toEqual([]);
    expect(result.podium).toEqual([]);
    expect(result.firstPlaceTie).toBeNull();
    expect(result.totalValidVotes).toBeNull();
    expect(JSON.stringify(result)).not.toContain("Primero");
  });

  it("en la primera fase solo viaja lo publicado", () => {
    const result = mask("LOWER_RANKS_REVEALED");
    const serialized = JSON.stringify(result);

    expect(result.groups.map((group) => group.position)).toEqual([6, 7]);
    expect(serialized).toContain("Sexto");
    expect(serialized).not.toContain("Primero");
    expect(serialized).not.toContain("Cuarto");
    expect(result.podium).toEqual([]);
    expect(result.firstPlaceTie).toBeNull();
  });

  it("en la segunda fase no se filtra el podio", () => {
    const result = mask("FOURTH_FIFTH_REVEALED");
    const serialized = JSON.stringify(result);

    expect(result.groups.map((group) => group.position)).toEqual([4, 5, 6, 7]);
    expect(serialized).toContain("Cuarto");
    expect(serialized).not.toContain("Tercero");
    expect(result.podium).toEqual([]);
  });

  it("con el podio publicado se envia todo", () => {
    const result = mask("PODIUM_REVEALED");

    expect(result.podium.map((group) => group.position)).toEqual([1, 2, 3]);
    expect(result.firstPlaceTie?.isTie).toBe(false);
    expect(result.totalValidVotes).toBe(34);
  });

  it("informa de las posiciones inexistentes ya publicas", () => {
    const pocas = [entry("A", 5, 1), entry("B", 3, 2), entry("C", 1, 3)];

    expect(mask("FOURTH_FIFTH_REVEALED", pocas).notices).toContain(
      "No hay opciones clasificadas en cuarto puesto."
    );
    expect(mask("FOURTH_FIFTH_REVEALED", pocas).notices).toContain(
      "No hay opciones clasificadas en quinto puesto."
    );
  });

  it("no anuncia posiciones inexistentes de fases todavia ocultas", () => {
    const empate = [entry("A", 5, 1), entry("B", 5, 2), entry("C", 1, 3)];
    const lower = mask("LOWER_RANKS_REVEALED", empate);

    expect(lower.notices.join(" ")).not.toContain("segundo puesto");
    expect(mask("PODIUM_REVEALED", empate).notices).toContain(
      "No existe segundo puesto debido al empate en primera posición."
    );
  });

  it("avisa cuando una fase publicada no tiene nada que mostrar", () => {
    const pocas = [entry("A", 5, 1), entry("B", 3, 2)];
    expect(mask("LOWER_RANKS_REVEALED", pocas).notices).toContain(
      "No existen resultados que revelar en esta fase."
    );
  });

  it("solo publica el empate en primera posicion cuando el podio es publico", () => {
    const empate = [entry("A", 6, 1), entry("B", 6, 2), entry("C", 2, 3)];

    expect(mask("FOURTH_FIFTH_REVEALED", empate).firstPlaceTie).toBeNull();
    expect(mask("PODIUM_REVEALED", empate).firstPlaceTie?.isTie).toBe(true);
  });

  it("no incluye opciones sin votos en ninguna fase", () => {
    const conCeros = [entry("A", 4, 1), entry("SinVotos", 0, 2)];
    expect(JSON.stringify(mask("PODIUM_REVEALED", conCeros))).not.toContain("SinVotos");
  });
});
