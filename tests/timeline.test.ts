import { describe, expect, it } from "vitest";
import type { ElectionRound } from "@prisma/client";
import { buildTimeline } from "@/lib/election/timeline";

const NOW = new Date("2027-03-01T19:00:00.000Z");

function round(overrides: Partial<ElectionRound> & { roundNumber: number }): ElectionRound {
  return {
    id: `ronda-${overrides.roundNumber}`,
    electionId: "eleccion",
    mode: "LIVE",
    roundNumber: overrides.roundNumber,
    sourceRoundId: null,
    status: "READY_TO_START",
    votingDurationSeconds: null,
    votingOpenedAt: null,
    votingClosesAt: null,
    votingClosedAt: null,
    votingStartedByMemberId: null,
    votingClosedByMemberId: null,
    resultsCountdownDurationSeconds: null,
    resultsCountdownStartedAt: null,
    resultsRevealAt: null,
    resultsRevealStage: "HIDDEN",
    lowerResultsRevealedAt: null,
    lowerResultsRevealedByMemberId: null,
    fourthFifthRevealedAt: null,
    fourthFifthRevealedByMemberId: null,
    podiumRevealedAt: null,
    podiumRevealedByMemberId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  } as unknown as ElectionRound;
}

function timeline(rounds: ElectionRound[], publicTie: boolean | null = null, deadline: Date | null = null) {
  return buildTimeline({
    election: { candidacyEditDeadline: deadline, rounds },
    now: NOW,
    publicFirstPlaceTie: publicTie
  });
}

function stateOf(rounds: ElectionRound[], key: string, publicTie: boolean | null = null) {
  return timeline(rounds, publicTie).phases.find((phase) => phase.key === key)?.state;
}

describe("linea temporal", () => {
  it("tiene las siete fases en orden", () => {
    const result = timeline([round({ roundNumber: 1 })]);
    expect(result.phases.map((phase) => phase.key)).toEqual([
      "candidaturas",
      "revision",
      "primera-vuelta",
      "preparacion",
      "revelacion",
      "segunda-vuelta",
      "resultado-final"
    ]);
  });

  it("antes del inicio la presentacion esta en curso y la votacion pendiente", () => {
    const rounds = [round({ roundNumber: 1 })];
    expect(stateOf(rounds, "candidaturas")).toBe("CURRENT");
    expect(stateOf(rounds, "primera-vuelta")).toBe("UPCOMING");
    expect(stateOf(rounds, "revelacion")).toBe("BLOCKED");
  });

  it("con el plazo vencido pasa a la fase de revision", () => {
    const rounds = [round({ roundNumber: 1 })];
    const result = timeline(rounds, null, new Date("2027-02-01T19:00:00.000Z"));
    expect(result.phases.find((phase) => phase.key === "candidaturas")?.state).toBe("COMPLETED");
    expect(result.phases.find((phase) => phase.key === "revision")?.state).toBe("CURRENT");
  });

  it("marca la votacion en curso mientras esta abierta", () => {
    const rounds = [
      round({
        roundNumber: 1,
        status: "VOTING_OPEN",
        votingDurationSeconds: 600,
        votingClosesAt: new Date("2027-03-01T19:10:00.000Z")
      })
    ];
    expect(stateOf(rounds, "primera-vuelta")).toBe("CURRENT");
    expect(timeline(rounds).nextAction).toBe("Votar antes del cierre.");
  });

  it("tras el cierre la preparacion de resultados esta en curso", () => {
    const rounds = [round({ roundNumber: 1, status: "VOTING_CLOSED" })];
    expect(stateOf(rounds, "primera-vuelta")).toBe("COMPLETED");
    expect(stateOf(rounds, "preparacion")).toBe("CURRENT");
  });

  it("la revelacion figura en curso en las fases intermedias", () => {
    const rounds = [
      round({ roundNumber: 1, status: "RESULTS_REVEALING", resultsRevealStage: "LOWER_RANKS_REVEALED" })
    ];
    expect(stateOf(rounds, "preparacion")).toBe("COMPLETED");
    expect(stateOf(rounds, "revelacion")).toBe("CURRENT");
  });

  it("la segunda vuelta es condicional mientras el resultado no es publico", () => {
    const rounds = [round({ roundNumber: 1, status: "VOTING_CLOSED" })];
    const phase = timeline(rounds, null).phases.find((item) => item.key === "segunda-vuelta");
    expect(phase?.state).toBe("CONDITIONAL");
    expect(phase?.detail).toBe("Solo si existe empate en primera posición");
  });

  it("se marca no necesaria solo cuando el resultado publico descarta el empate", () => {
    const rounds = [
      round({ roundNumber: 1, status: "RESULTS_PUBLISHED", resultsRevealStage: "PODIUM_REVEALED" })
    ];
    expect(stateOf(rounds, "segunda-vuelta", false)).toBe("NOT_APPLICABLE");
    expect(stateOf(rounds, "resultado-final", false)).toBe("COMPLETED");
  });

  it("no anticipa el resultado final cuando el empate es publico y falta la segunda vuelta", () => {
    const rounds = [
      round({ roundNumber: 1, status: "RESULTS_PUBLISHED", resultsRevealStage: "PODIUM_REVEALED" })
    ];
    expect(stateOf(rounds, "segunda-vuelta", true)).toBe("CONDITIONAL");
    expect(stateOf(rounds, "resultado-final", true)).toBe("UPCOMING");
  });

  it("refleja la segunda vuelta existente sin filtrar el empate", () => {
    const rounds = [
      round({ roundNumber: 1, status: "RESULTS_PUBLISHED", resultsRevealStage: "PODIUM_REVEALED" }),
      round({ roundNumber: 2, sourceRoundId: "ronda-1" })
    ];
    expect(stateOf(rounds, "segunda-vuelta", true)).toBe("UPCOMING");
    expect(timeline(rounds, true).nextAction).toBe("La Junta iniciará la segunda vuelta.");
  });

  it("no filtra ninguna informacion oculta en los textos", () => {
    const rounds = [round({ roundNumber: 1, status: "VOTING_CLOSED" })];
    const serialized = JSON.stringify(timeline(rounds, null));
    expect(serialized).not.toContain("empate en primera posición:");
    expect(serialized).not.toContain("votos");
  });
});
