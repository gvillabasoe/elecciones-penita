import { describe, expect, it } from "vitest";
import {
  buildRankGroups,
  canAdvanceTo,
  detectFirstPlaceTie,
  fourthFifthGroups,
  hasFourthOrFifth,
  isGroupVisible,
  lowerGroups,
  missingPositionMessage,
  podiumGroups,
  positionExists,
  visibleGroupsAscending,
  type TallyEntry
} from "@/lib/results/ranking";

/** Cada opcion representa a UN MIEMBRO: no existen opciones de candidatura. */
function entry(memberName: string, votes: number, sortOrder: number, candidacyName?: string): TallyEntry {
  return {
    optionId: `opcion-${sortOrder}`,
    memberId: `miembro-${sortOrder}`,
    memberName,
    candidacyId: candidacyName ? `candidatura-${sortOrder}` : null,
    candidacyName: candidacyName ?? null,
    slogan: candidacyName ? "Eslogan" : null,
    hasFormalCandidacy: Boolean(candidacyName),
    color: "#CFDDE3",
    sortOrder,
    votes
  };
}

describe("ranking de competicion", () => {
  it("comparte posicion en los empates y salta la siguiente: 1, 1, 3", () => {
    const groups = buildRankGroups([entry("A", 5, 1), entry("B", 5, 2), entry("C", 3, 3)]);

    expect(groups.map((group) => group.position)).toEqual([1, 3]);
    expect(groups[0]?.options).toHaveLength(2);
  });

  it("aplica el patron 1, 2, 2, 4", () => {
    const groups = buildRankGroups([
      entry("A", 9, 1),
      entry("B", 4, 2),
      entry("C", 4, 3),
      entry("D", 1, 4)
    ]);

    expect(groups.map((group) => group.position)).toEqual([1, 2, 4]);
  });

  it("aplica el patron 1, 1, 1, 4", () => {
    const groups = buildRankGroups([
      entry("A", 7, 1),
      entry("B", 7, 2),
      entry("C", 7, 3),
      entry("D", 2, 4)
    ]);

    expect(groups.map((group) => group.position)).toEqual([1, 4]);
    expect(groups[0]?.options).toHaveLength(3);
  });

  it("aplica el patron 1, 1, 1, 1", () => {
    const groups = buildRankGroups([
      entry("A", 3, 1),
      entry("B", 3, 2),
      entry("C", 3, 3),
      entry("D", 3, 4)
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.position).toBe(1);
    expect(groups[0]?.options).toHaveLength(4);
  });

  it("aplica el patron 1, 2, 3, 3, 5", () => {
    const groups = buildRankGroups([
      entry("A", 10, 1),
      entry("B", 8, 2),
      entry("C", 6, 3),
      entry("D", 6, 4),
      entry("E", 2, 5)
    ]);

    expect(groups.map((group) => group.position)).toEqual([1, 2, 3, 5]);
    expect(positionExists(groups, 4)).toBe(false);
  });

  it("no usa DENSE_RANK: tras un empate doble la siguiente posicion salta", () => {
    const groups = buildRankGroups([entry("A", 5, 1), entry("B", 5, 2), entry("C", 4, 3)]);
    expect(groups.map((group) => group.position)).not.toEqual([1, 2]);
  });

  it("excluye las opciones sin ningun voto", () => {
    const groups = buildRankGroups([entry("A", 2, 1), entry("B", 0, 2), entry("C", 0, 3)]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.options.map((option) => option.memberName)).toEqual(["A"]);
  });

  it("no divide los votos de un miembro con candidatura", () => {
    const groups = buildRankGroups([entry("A", 6, 1, "Candidatura Norte"), entry("B", 4, 2)]);

    expect(groups[0]?.options).toHaveLength(1);
    expect(groups[0]?.options[0]?.votes).toBe(6);
    expect(groups[0]?.options[0]?.hasFormalCandidacy).toBe(true);
    expect(groups[0]?.options[0]?.candidacyName).toBe("Candidatura Norte");
  });

  it("ordena el empate alfabeticamente sin romperlo", () => {
    const groups = buildRankGroups([entry("Zulema", 5, 1), entry("Ana", 5, 2)]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.options.map((option) => option.memberName)).toEqual(["Ana", "Zulema"]);
    expect(groups[0]?.options.every((option) => option.position === 1)).toBe(true);
  });

  it("calcula porcentajes sobre el total de votos validos", () => {
    const groups = buildRankGroups([entry("A", 3, 1), entry("B", 1, 2)]);

    expect(groups[0]?.percentage).toBe(75);
    expect(groups[1]?.percentage).toBe(25);
  });

  it("no falla sin ningun voto", () => {
    expect(buildRankGroups([])).toEqual([]);
    expect(buildRankGroups([entry("A", 0, 1)])).toEqual([]);
  });
});

describe("reparto por fases", () => {
  const groups = buildRankGroups([
    entry("Primero", 10, 1),
    entry("Segundo", 9, 2),
    entry("Tercero", 8, 3),
    entry("Cuarto", 7, 4),
    entry("Quinto", 6, 5),
    entry("Sexto", 5, 6),
    entry("Septimo", 1, 7)
  ]);

  it("separa podio, puestos 4 y 5 y resto", () => {
    expect(podiumGroups(groups).map((group) => group.position)).toEqual([1, 2, 3]);
    expect(fourthFifthGroups(groups).map((group) => group.position)).toEqual([4, 5]);
    expect(lowerGroups(groups).map((group) => group.position)).toEqual([6, 7]);
  });

  it("oculta todo en la fase HIDDEN", () => {
    for (const group of groups) {
      expect(isGroupVisible(group, "HIDDEN")).toBe(false);
    }
  });

  it("solo muestra de la sexta posicion en adelante en la primera fase", () => {
    const visibles = groups.filter((group) => isGroupVisible(group, "LOWER_RANKS_REVEALED"));
    expect(visibles.map((group) => group.position)).toEqual([6, 7]);
  });

  it("anade los puestos 4 y 5 en la segunda fase", () => {
    const visibles = groups.filter((group) => isGroupVisible(group, "FOURTH_FIFTH_REVEALED"));
    expect(visibles.map((group) => group.position)).toEqual([4, 5, 6, 7]);
  });

  it("muestra todo con el podio revelado", () => {
    expect(groups.filter((group) => isGroupVisible(group, "PODIUM_REVEALED"))).toHaveLength(
      groups.length
    );
  });

  it("anima de menos a mas votos", () => {
    const orden = visibleGroupsAscending(groups, "PODIUM_REVEALED").map((group) => group.votes);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it("oculta en la primera fase un empate que cruza el limite del top 5", () => {
    const conEmpate = buildRankGroups([
      entry("Primero", 10, 1),
      entry("Segundo", 9, 2),
      entry("Tercero", 8, 3),
      entry("Cuarto", 7, 4),
      entry("QuintoA", 6, 5),
      entry("QuintoB", 6, 6),
      entry("Septimo", 2, 7)
    ]);

    const empate = conEmpate.find((group) => group.position === 5);
    expect(empate?.options).toHaveLength(2);
    expect(isGroupVisible(empate!, "LOWER_RANKS_REVEALED")).toBe(false);
    expect(isGroupVisible(empate!, "FOURTH_FIFTH_REVEALED")).toBe(true);
  });

  it("solo permite avanzar de fase en un sentido", () => {
    expect(canAdvanceTo("HIDDEN", "LOWER_RANKS_REVEALED")).toBe(true);
    expect(canAdvanceTo("HIDDEN", "PODIUM_REVEALED")).toBe(false);
    expect(canAdvanceTo("PODIUM_REVEALED", "FOURTH_FIFTH_REVEALED")).toBe(false);
    expect(canAdvanceTo("LOWER_RANKS_REVEALED", "HIDDEN")).toBe(false);
  });
});

describe("posiciones inexistentes", () => {
  it("explica la ausencia de segundo puesto por empate en primera", () => {
    const groups = buildRankGroups([entry("A", 5, 1), entry("B", 5, 2), entry("C", 2, 3)]);
    expect(missingPositionMessage(groups, 2)).toBe(
      "No existe segundo puesto debido al empate en primera posición."
    );
  });

  it("explica la ausencia de tercer puesto por empate en segunda", () => {
    const groups = buildRankGroups([entry("A", 9, 1), entry("B", 5, 2), entry("C", 5, 3)]);
    expect(missingPositionMessage(groups, 3)).toBe(
      "No existe tercer puesto debido al empate en segunda posición."
    );
  });

  it("explica la ausencia de cuarto y quinto puesto", () => {
    const groups = buildRankGroups([entry("A", 6, 1), entry("B", 4, 2), entry("C", 2, 3)]);
    expect(missingPositionMessage(groups, 4)).toBe("No hay opciones clasificadas en cuarto puesto.");
    expect(missingPositionMessage(groups, 5)).toBe("No hay opciones clasificadas en quinto puesto.");
    expect(hasFourthOrFifth(groups)).toBe(false);
  });

  it("no devuelve mensaje cuando la posicion si existe", () => {
    const groups = buildRankGroups([entry("A", 6, 1), entry("B", 4, 2)]);
    expect(missingPositionMessage(groups, 2)).toBeNull();
  });
});

describe("empate en primera posicion", () => {
  it("detecta el empate cuando hay votos", () => {
    const tie = detectFirstPlaceTie(buildRankGroups([entry("A", 4, 1), entry("B", 4, 2), entry("C", 1, 3)]));

    expect(tie.isTie).toBe(true);
    expect(tie.votes).toBe(4);
    expect(tie.options.map((option) => option.memberName)).toEqual(["A", "B"]);
  });

  it("no hay empate con un unico primero", () => {
    expect(detectFirstPlaceTie(buildRankGroups([entry("A", 5, 1), entry("B", 4, 2)])).isTie).toBe(false);
  });

  it("no hay empate sin ningun voto", () => {
    const tie = detectFirstPlaceTie(buildRankGroups([entry("A", 0, 1), entry("B", 0, 2)]));
    expect(tie.isTie).toBe(false);
    expect(tie.votes).toBe(0);
  });

  it("detecta el empate a tres", () => {
    const tie = detectFirstPlaceTie(
      buildRankGroups([entry("A", 3, 1), entry("B", 3, 2), entry("C", 3, 3)])
    );
    expect(tie.isTie).toBe(true);
    expect(tie.options).toHaveLength(3);
  });
});
