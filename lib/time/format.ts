import { APP_TIME_ZONE } from "@/lib/time/constants";

/**
 * Formato de fechas y horas.
 *
 * Los instantes electorales se guardan en UTC y se muestran en Europe/Madrid.
 * Las fechas tentativas de las candidaturas son fechas de calendario sin hora
 * y se formatean en UTC para que nunca cambien de dia.
 */

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const timeFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

const calendarFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  day: "2-digit",
  month: "long",
  year: "numeric"
});

/** Instante completo en hora de Madrid. */
export function formatInstant(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormatter.format(date);
}

export function formatClock(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return timeFormatter.format(date);
}

/** Fecha de calendario sin hora (no se desplaza por zona horaria). */
export function formatCalendarDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return calendarFormatter.format(date);
}

export function formatCalendarRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  if (!start && !end) return "—";
  if (start && end) return `${formatCalendarDate(start)} — ${formatCalendarDate(end)}`;
  return formatCalendarDate(start ?? end);
}

/** Convierte "2027-06-12" en un Date UTC a medianoche, sin desplazamiento. */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Devuelve "YYYY-MM-DD" a partir de un Date, para prellenar inputs. */
export function toCalendarInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Devuelve "YYYY-MM-DDTHH:mm" en hora de Madrid, para inputs datetime-local. */
export function toDateTimeLocalValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  return parts.replace(" ", "T");
}

/** Desplazamiento de Europe/Madrid respecto a UTC, en milisegundos. */
function timeZoneOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);

  const [datePart, timePart] = parts.split(" ");
  if (!datePart || !timePart) return 0;

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  const asIfUtc = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0);
  return asIfUtc - date.getTime();
}

/**
 * Convierte "YYYY-MM-DDTHH:mm" entendido como hora de Madrid al instante UTC
 * correspondiente. Tiene en cuenta el horario de verano.
 */
export function fromDateTimeLocalValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const asIfUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));

  let instant = asIfUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    instant = asIfUtc - timeZoneOffsetMs(new Date(instant));
  }

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}
