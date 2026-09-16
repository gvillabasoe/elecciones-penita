import { randomInt } from "node:crypto";

/**
 * Generacion de colores pastel para las candidaturas.
 *
 * Se genera en servidor, se guarda en base de datos y no cambia nunca.
 * Rangos: saturacion 45-70 %, luminosidad 76-88 %.
 */

const SATURATION_MIN = 45;
const SATURATION_MAX = 70;
const LIGHTNESS_MIN = 76;
const LIGHTNESS_MAX = 88;
const MIN_HUE_DISTANCE = 28;
const MAX_ATTEMPTS = 60;
const GOLDEN_ANGLE = 137.508;

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const offset = l - chroma / 2;

  let rgb: [number, number, number];
  if (h < 60) rgb = [chroma, secondary, 0];
  else if (h < 120) rgb = [secondary, chroma, 0];
  else if (h < 180) rgb = [0, chroma, secondary];
  else if (h < 240) rgb = [0, secondary, chroma];
  else if (h < 300) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];

  const toChannel = (value: number) =>
    Math.round((value + offset) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toChannel(rgb[0])}${toChannel(rgb[1])}${toChannel(rgb[2])}`.toUpperCase();
}

export function hexToHue(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match || !match[1]) return null;

  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;

  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);

  return ((hue % 360) + 360) % 360;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Devuelve un pastel suficientemente distinto de los ya usados.
 * Si no lo encuentra, cae en un reparto determinista por angulo dorado.
 */
export function generateDistinctPastel(existingColors: readonly string[]): string {
  const existingHues = existingColors
    .map(hexToHue)
    .filter((hue): hue is number => hue !== null);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const hue = randomInt(0, 360);
    const isFarEnough = existingHues.every((used) => hueDistance(hue, used) >= MIN_HUE_DISTANCE);
    if (isFarEnough) {
      const saturation = randomInt(SATURATION_MIN, SATURATION_MAX + 1);
      const lightness = randomInt(LIGHTNESS_MIN, LIGHTNESS_MAX + 1);
      return hslToHex(hue, saturation, lightness);
    }
  }

  const deterministicHue = (existingHues.length * GOLDEN_ANGLE) % 360;
  return hslToHex(deterministicHue, 58, 82);
}

/** Color de texto legible sobre un pastel claro. */
export function readableInkOn(_hex: string): string {
  return "#123945";
}
