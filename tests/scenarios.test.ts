import { describe, expect, it } from "vitest";
import { SCENARIOS, findScenario, SCENARIO_KEYS } from "@/lib/testing/scenarios";
import { maskResults } from "@/lib/results/mask";
import {
  buildRankGroups,
  detectFirstPlaceTie,
  hasFourthOrFifth,
  positionExists,
  totalVotes
} from "@/lib/results/ranking";

function groupsOf(key: string) {
  const scenario = findScenario(key);
  expect(scenario).not.toBeNull();
  return buildRankGroups(scenario!.entries);
}

describe("escenarios de ensayo", () => {
  it("hay quince escenarios con clave unica", () => {
    expect(SCENARIOS).toHaveLength(15);
    expect(new Set(SCENARIO_KEYS).size).toBe(15);
  });

  it("no usa nombres reales de miembros", () => {
    const serialized = JSON.stringify(SCENARIOS);
    for (const name of ["Gomeza", "Villabaso", "Antepara", "Goyoaga"]) {
      expect(serialized).not.toContain(name);
    }
  });

  it("todos los identificadores son ficticios", () => {
    for (const scenario of SCENARIOS) {
      for (const entry of scenario.entries) {
        expect(entry.optionId.startsWith("ficticio-")).toBe(true);
        expect(entry.memberId.startsWith("miembro-ficticio-")).toBe(true);
      }
    }
  });

  it("simula el empate en primera posicion", () => {
    const tie = detectFirstPlaceTie(groupsOf("empate-primero"));
    expect(tie.isTie).toBe(true);
    expect(tie.options).toHaveLength(2);
  });

  it("simula el empate multiple en primera posicion", () => {
    const groups = groupsOf("empate-multiple-primero");
    expect(groups[0]?.options).toHaveLength(3);
    expect(groups.map((group) => group.position)).toEqual([1, 4, 5]);
  });

  it("simula la ausencia de cuarto puesto", () => {
    const groups = groupsOf("sin-cuarto");
    expect(positionExists(groups, 4)).toBe(false);
    expect(positionExists(groups, 3)).toBe(true);
  });

  it("simula la ausencia de quinto puesto", () => {
    expect(positionExists(groupsOf("sin-quinto"), 5)).toBe(false);
  });

  it("simula menos de cinco opciones con votos", () => {
    const groups = groupsOf("menos-de-cinco");
    expect(groups).toHaveLength(3);
    expect(hasFourthOrFifth(groups)).toBe(false);
  });

  it("simula una unica opcion con votos", () => {
    const groups = groupsOf("una-opcion");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.options).toHaveLength(1);
  });

  it("simula el estado vacio sin ningun voto", () => {
    const scenario = findScenario("sin-votos");
    const groups = buildRankGroups(scenario!.entries);
    expect(groups).toEqual([]);

    const masked = maskResults({
      roundId: "simulacion",
      roundNumber: 1,
      stage: "PODIUM_REVEALED",
      groups,
      totalValidVotes: 0,
      participationCount: 0,
      ballotCount: 0
    });

    expect(masked.podium).toEqual([]);
    expect(masked.notices).toContain("No existen resultados que revelar en esta fase.");
  });

  it("simula una segunda vuelta nuevamente empatada", () => {
    const tie = detectFirstPlaceTie(groupsOf("segunda-vuelta-empatada"));
    expect(tie.isTie).toBe(true);
    expect(tie.votes).toBe(12);
  });

  it("soporta muchas opciones y textos largos", () => {
    expect(groupsOf("muchas-opciones").length).toBe(20);
    const largos = findScenario("textos-largos");
    expect(largos!.entries[0]?.slogan?.length).toBeGreaterThan(100);
  });

  it("los totales de cada escenario son coherentes", () => {
    for (const scenario of SCENARIOS) {
      const groups = buildRankGroups(scenario.entries);
      const sum = groups.reduce(
        (acc, group) => acc + group.options.reduce((inner, option) => inner + option.votes, 0),
        0
      );
      expect(sum).toBe(totalVotes(scenario.entries));
    }
  });

  it("devuelve null con una clave desconocida", () => {
    expect(findScenario("inexistente")).toBeNull();
    expect(findScenario(null)).toBeNull();
  });
});
