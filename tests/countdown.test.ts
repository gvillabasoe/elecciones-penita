import { describe, expect, it } from "vitest";
import {
  ANNOUNCED_MILESTONES,
  countdownColor,
  countdownTone,
  formatRemaining,
  milestoneLabel
} from "@/lib/theme/countdown";

/**
 * Los limites de tramo son exactos: el segundo 300 ya es amarillo, el 120 ya
 * es naranja, el 60 ya es rojo y el 30 ya es granate.
 */

describe("tramos de color de la cuenta atras", () => {
  it("usa verde por encima de 5:00", () => {
    expect(countdownColor(3600)).toBe("#00AD8C");
    expect(countdownColor(301)).toBe("#00AD8C");
    expect(countdownTone(301)).toBe("calm");
  });

  it("cambia a amarillo exactamente en 5:00", () => {
    expect(countdownColor(300)).toBe("#F7BD63");
    expect(countdownColor(121)).toBe("#F7BD63");
  });

  it("cambia a naranja exactamente en 2:00", () => {
    expect(countdownColor(120)).toBe("#F89D55");
    expect(countdownColor(61)).toBe("#F89D55");
  });

  it("cambia a rojo exactamente en 1:00", () => {
    expect(countdownColor(60)).toBe("#F2664A");
    expect(countdownColor(31)).toBe("#F2664A");
  });

  it("cambia a granate exactamente en 0:30", () => {
    expect(countdownColor(30)).toBe("#7B3F50");
    expect(countdownColor(1)).toBe("#7B3F50");
    expect(countdownColor(0)).toBe("#7B3F50");
  });

  it("no devuelve nunca un color fuera de la paleta", () => {
    const paleta = new Set(["#00AD8C", "#F7BD63", "#F89D55", "#F2664A", "#7B3F50"]);
    for (let seconds = 0; seconds <= 400; seconds += 1) {
      expect(paleta.has(countdownColor(seconds))).toBe(true);
    }
  });

  it("trata los valores negativos como cero", () => {
    expect(countdownColor(-10)).toBe("#7B3F50");
  });
});

describe("formato del tiempo restante", () => {
  it("usa MM:SS por debajo de una hora", () => {
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(9)).toBe("00:09");
    expect(formatRemaining(90)).toBe("01:30");
    expect(formatRemaining(3599)).toBe("59:59");
  });

  it("usa HH:MM:SS a partir de una hora", () => {
    expect(formatRemaining(3600)).toBe("01:00:00");
    expect(formatRemaining(7325)).toBe("02:02:05");
  });

  it("incluye los dias cuando procede", () => {
    expect(formatRemaining(90061)).toBe("1 d 01:01:01");
  });
});

describe("hitos anunciados", () => {
  it("solo anuncia los hitos previstos", () => {
    for (const milestone of ANNOUNCED_MILESTONES) {
      expect(milestoneLabel(milestone)).not.toBeNull();
    }
    expect(milestoneLabel(299)).toBeNull();
    expect(milestoneLabel(121)).toBeNull();
    expect(milestoneLabel(45)).toBeNull();
  });
});
