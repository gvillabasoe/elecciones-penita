/**
 * Color estable para los miembros sin candidatura formal.
 *
 * Es determinista a partir del identificador estable del miembro: el mismo
 * miembro recibe siempre el mismo color, de modo que no puede cambiar durante
 * una ronda. Se mantiene en una franja clara y desaturada para que contraste
 * con los pasteles de candidatura y siga siendo legible con tinta oscura.
 */

import { hslToHex } from "@/lib/theme/pastel";

const SATURATION = 24;
const LIGHTNESS = 86;

/** Hash FNV-1a de 32 bits. Estable entre ejecuciones y plataformas. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Color determinista y accesible para una opcion sin candidatura. */
export function memberOptionColor(stableKey: string): string {
  const hue = stableHash(stableKey) % 360;
  return hslToHex(hue, SATURATION, LIGHTNESS);
}
