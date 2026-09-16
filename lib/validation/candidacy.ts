import { z } from "zod";

/**
 * Validacion de candidaturas y de las acciones de la Junta Electoral.
 * Se aplica siempre en servidor, aunque el cliente valide primero.
 */

const trimmed = (max: number) => z.string().trim().max(max);

const requiredText = (max: number, field: string) =>
  trimmed(max).min(1, { message: `${field} es obligatorio.` });

const calendarDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Introduce una fecha válida." });

const singleDateProposal = z.object({
  place: requiredText(120, "El lugar"),
  startDate: calendarDate,
  description: requiredText(600, "La descripción")
});

const dateRangeProposal = z
  .object({
    place: requiredText(120, "El lugar"),
    startDate: calendarDate,
    endDate: calendarDate,
    description: requiredText(600, "La descripción")
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "La fecha final no puede ser anterior a la inicial.",
    path: ["endDate"]
  });

export const candidacySchema = z.object({
  name: requiredText(80, "El nombre de la candidatura"),
  slogan: requiredText(140, "El eslogan"),

  annualGroupPlan: z.object({
    title: requiredText(100, "El título"),
    place: requiredText(120, "El lugar"),
    startDate: calendarDate,
    description: requiredText(600, "La descripción")
  }),
  semanaGrandeDinner: singleDateProposal,
  christmasDinner: singleDateProposal,

  party: singleDateProposal.nullish(),
  event: singleDateProposal.nullish(),
  ruralHouse: dateRangeProposal.nullish(),
  trip: dateRangeProposal.nullish(),
  weekendGetaway: dateRangeProposal.nullish(),

  promises: z
    .array(requiredText(200, "La promesa"))
    .max(20, { message: "Como máximo 20 promesas." })
    .nullish()
});

export type CandidacyInput = z.infer<typeof candidacySchema>;

export const exclusionSchema = z.object({
  memberId: z.string().uuid(),
  reasons: z
    .array(z.enum(["PREVIOUS_PRESIDENT", "ABSENT_CHRISTMAS_DINNER"]))
    .min(1, { message: "Toda exclusión debe tener al menos un motivo." })
});

export const reinstateSchema = z.object({
  memberId: z.string().uuid()
});

export const durationSchema = z.object({
  roundId: z.string().uuid(),
  mode: electionModeSchema,
  seconds: z.coerce.number().int().min(10).max(604800)
});

export const resultsCountdownSchema = z.object({
  roundId: z.string().uuid(),
  mode: electionModeSchema,
  seconds: z.coerce.number().int().min(5).max(604800)
});

export const electionModeSchema = z.enum(["TEST", "LIVE"]);

/**
 * Toda accion sobre una ronda declara el modo al que dice pertenecer. La capa
 * de dominio vuelve a comprobarlo contra la base de datos: una accion de
 * prueba nunca puede operar sobre una ronda real, ni al contrario.
 */
export const roundActionSchema = z.object({
  roundId: z.string().uuid(),
  mode: electionModeSchema
});

export const deadlineSchema = z.object({
  deadline: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { message: "Introduce una fecha y hora válidas." })
    .nullish()
});

/** Reinicio de simulacion: solo aplicable a rondas en modo TEST. */
export const resetSchema = z.object({
  roundId: z.string().uuid(),
  mode: z.literal("TEST", {
    errorMap: () => ({ message: "El reinicio solo está disponible en modo de prueba." })
  }),
  confirmation: z.literal("REINICIAR", {
    errorMap: () => ({ message: 'Escribe exactamente "REINICIAR" para confirmar.' })
  })
});

export const voteSchema = z.object({
  roundId: z.string().uuid(),
  /** Identificador de la opcion congelada. Cada opcion representa a un miembro. */
  optionId: z.string().uuid({ message: "Selecciona una opción válida." })
});

export const correctionRequestSchema = z.object({
  candidacyId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(10, { message: "Explica el motivo de la corrección (al menos 10 caracteres)." })
    .max(600, { message: "El motivo no puede superar los 600 caracteres." })
});

export const reviewStatusSchema = z.object({
  candidacyId: z.string().uuid(),
  status: z.enum(["VALID", "INVALID"])
});

export const comparisonSchema = z.object({
  a: z.string().uuid().nullish(),
  b: z.string().uuid().nullish()
});

export const candidacyIdSchema = z.object({
  candidacyId: z.string().uuid()
});

/** Convierte los errores de Zod en un mensaje unico legible en espanol. */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Revisa los datos introducidos.";
  return issue.message;
}
