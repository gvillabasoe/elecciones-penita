/**
 * Colores de la cuenta atras segun el tiempo restante.
 *
 * Tramos exigidos:
 *   > 5:00            -> #00AD8C
 *   5:00 .. > 2:00    -> #F7BD63
 *   2:00 .. > 1:00    -> #F89D55
 *   1:00 .. > 0:30    -> #F2664A
 *   0:30 .. 0:00      -> #7B3F50
 *
 * Limites exactos comprobados en tests:
 *   5:01 verde, 5:00 amarillo, 2:01 amarillo, 2:00 naranja,
 *   1:01 naranja, 1:00 rojo, 0:31 rojo, 0:30 granate.
 */

export const COUNTDOWN_COLORS = {
  calm: "#00AD8C",
  warning: "#F7BD63",
  alert: "#F89D55",
  urgent: "#F2664A",
  critical: "#7B3F50"
} as const;

export type CountdownTone = keyof typeof COUNTDOWN_COLORS;

/** Devuelve el tono correspondiente a los segundos restantes (>= 0). */
export function countdownTone(remainingSeconds: number): CountdownTone {
  const seconds = Math.max(0, Math.floor(remainingSeconds));
  if (seconds > 300) return "calm";
  if (seconds > 120) return "warning";
  if (seconds > 60) return "alert";
  if (seconds > 30) return "urgent";
  return "critical";
}

/** Devuelve el color hexadecimal correspondiente a los segundos restantes. */
export function countdownColor(remainingSeconds: number): string {
  return COUNTDOWN_COLORS[countdownTone(remainingSeconds)];
}

/** Formatea los segundos restantes como D d HH:MM:SS, HH:MM:SS o MM:SS. */
export function formatRemaining(remainingSeconds: number): string {
  const total = Math.max(0, Math.floor(remainingSeconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  if (days > 0) return `${days} d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Hitos que se anuncian a lectores de pantalla, en segundos. */
export const ANNOUNCED_MILESTONES = [300, 120, 60, 30, 0] as const;

export function milestoneLabel(seconds: number): string | null {
  switch (seconds) {
    case 300:
      return "Quedan 5 minutos de votación.";
    case 120:
      return "Quedan 2 minutos de votación.";
    case 60:
      return "Queda 1 minuto de votación.";
    case 30:
      return "Quedan 30 segundos de votación.";
    case 0:
      return "La votación ha finalizado.";
    default:
      return null;
  }
}
