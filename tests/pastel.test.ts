import { describe, expect, it } from "vitest";
import { generateDistinctPastel, hexToHue, hslToHex } from "@/lib/theme/pastel";

/** Rangos exigidos: saturacion 45-70 %, luminosidad 76-88 %. */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h: hexToHue(hex) ?? 0, s: s * 100, l: l * 100 };
}

describe("conversion de color", () => {
  it("devuelve hexadecimal en mayusculas", () => {
    expect(hslToHex(200, 58, 82)).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("conserva el tono al ir y volver", () => {
    for (const hue of [0, 45, 120, 200, 275, 330]) {
      const hex = hslToHex(hue, 58, 82);
      expect(Math.abs((hexToHue(hex) ?? -1) - hue)).toBeLessThan(2.5);
    }
  });

  it("rechaza cadenas que no son color", () => {
    expect(hexToHue("verde")).toBeNull();
    expect(hexToHue("#12345")).toBeNull();
  });
});

describe("pastel de candidatura", () => {
  it("respeta los rangos de saturacion y luminosidad", () => {
    for (let i = 0; i < 100; i += 1) {
      const { s, l } = hexToHsl(generateDistinctPastel([]));
      expect(s).toBeGreaterThanOrEqual(44);
      expect(s).toBeLessThanOrEqual(71);
      expect(l).toBeGreaterThanOrEqual(75);
      expect(l).toBeLessThanOrEqual(89);
    }
  });

  it("se separa de los tonos ya usados", () => {
    const usados = [hslToHex(30, 58, 82), hslToHex(200, 58, 82)];
    for (let i = 0; i < 50; i += 1) {
      const hue = hexToHue(generateDistinctPastel(usados)) ?? 0;
      for (const usado of usados) {
        const referencia = hexToHue(usado) ?? 0;
        const diff = Math.abs(hue - referencia) % 360;
        expect(diff > 180 ? 360 - diff : diff).toBeGreaterThanOrEqual(25);
      }
    }
  });

  it("sigue devolviendo un color cuando la rueda esta saturada", () => {
    const usados = Array.from({ length: 24 }, (_, index) => hslToHex(index * 15, 58, 82));
    expect(generateDistinctPastel(usados)).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("ignora los valores no validos de la lista de usados", () => {
    expect(generateDistinctPastel(["", "no-es-color"])).toMatch(/^#[0-9A-F]{6}$/);
  });
});
