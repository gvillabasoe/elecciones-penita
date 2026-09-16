/**
 * Design tokens centralizados.
 * Los mismos valores estan expuestos como variables CSS en app/globals.css.
 */

export const COLORS = {
  background: "#FFFFFF",
  primary: "#1A4756",
  switchOn: "#00AD8C",
  exclusion: "#7B3F50",
  switchOff: "#DDE3E5",
  gold: "#D4AF37",
  silver: "#AEB6BF",
  bronze: "#CD7F32"
} as const;

/**
 * Las opciones sin candidatura formal no usan un color fijo: reciben un color
 * estable y determinista por miembro (ver lib/theme/member-color.ts).
 */

/** Tinta legible sobre superficies pastel claras. */
export const PASTEL_INK = "#123945";
