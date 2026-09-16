import { describe, expect, it } from "vitest";
import {
  candidacySchema,
  correctionRequestSchema,
  deadlineSchema,
  durationSchema,
  resetSchema,
  resultsCountdownSchema,
  reviewStatusSchema,
  roundActionSchema,
  voteSchema
} from "@/lib/validation/candidacy";
import {
  formatCalendarDate,
  fromDateTimeLocalValue,
  parseCalendarDate,
  toCalendarInputValue
} from "@/lib/time/format";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const candidaturaMinima = {
  name: "Peñita Adelante",
  slogan: "Más planes y menos excusas",
  annualGroupPlan: {
    title: "Ruta por Navarra",
    place: "Ulzama",
    startDate: "2027-05-15",
    description: "Fin de semana de golf y monte."
  },
  semanaGrandeDinner: {
    place: "Bilbao",
    startDate: "2027-08-21",
    description: "Cena en el Casco Viejo."
  },
  christmasDinner: {
    place: "Getxo",
    startDate: "2027-12-23",
    description: "Cena anual de Navidad."
  }
};

describe("validacion de candidatura", () => {
  it("acepta las tres propuestas obligatorias", () => {
    expect(candidacySchema.safeParse(candidaturaMinima).success).toBe(true);
  });

  it("rechaza la falta de eslogan", () => {
    const result = candidacySchema.safeParse({ ...candidaturaMinima, slogan: "   " });
    expect(result.success).toBe(false);
  });

  it("rechaza una fecha con formato incorrecto", () => {
    const result = candidacySchema.safeParse({
      ...candidaturaMinima,
      christmasDinner: { ...candidaturaMinima.christmasDinner, startDate: "23/12/2027" }
    });
    expect(result.success).toBe(false);
  });

  it("acepta un rango de fechas coherente", () => {
    const result = candidacySchema.safeParse({
      ...candidaturaMinima,
      trip: {
        place: "Oporto",
        startDate: "2027-09-10",
        endDate: "2027-09-13",
        description: "Viaje de tres noches."
      }
    });
    expect(result.success).toBe(true);
  });

  it("acepta un rango de un solo dia", () => {
    const result = candidacySchema.safeParse({
      ...candidaturaMinima,
      ruralHouse: {
        place: "Karrantza",
        startDate: "2027-04-10",
        endDate: "2027-04-10",
        description: "Casa rural de un dia."
      }
    });
    expect(result.success).toBe(true);
  });

  it("rechaza una fecha final anterior a la inicial", () => {
    const result = candidacySchema.safeParse({
      ...candidaturaMinima,
      weekendGetaway: {
        place: "Laredo",
        startDate: "2027-07-10",
        endDate: "2027-07-08",
        description: "Escapada."
      }
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("La fecha final no puede ser anterior a la inicial.");
    }
  });

  it("permite no enviar ninguna propuesta opcional", () => {
    const result = candidacySchema.safeParse({
      ...candidaturaMinima,
      party: null,
      event: null,
      ruralHouse: null,
      trip: null,
      weekendGetaway: null,
      promises: []
    });
    expect(result.success).toBe(true);
  });
});

describe("confirmaciones y rangos", () => {
  it("exige la palabra REINICIAR exacta y el modo de prueba", () => {
    expect(resetSchema.safeParse({ roundId: UUID, mode: "TEST", confirmation: "REINICIAR" }).success).toBe(
      true
    );
    expect(resetSchema.safeParse({ roundId: UUID, mode: "TEST", confirmation: "reiniciar" }).success).toBe(
      false
    );
    expect(resetSchema.safeParse({ roundId: UUID, mode: "TEST", confirmation: "REINICIAR " }).success).toBe(
      false
    );
    expect(resetSchema.safeParse({ roundId: UUID, mode: "TEST", confirmation: "" }).success).toBe(false);
  });

  it("rechaza el reinicio de una ronda real", () => {
    const result = resetSchema.safeParse({ roundId: UUID, mode: "LIVE", confirmation: "REINICIAR" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "El reinicio solo está disponible en modo de prueba."
      );
    }
  });

  it("toda accion sobre una ronda declara su modo", () => {
    expect(roundActionSchema.safeParse({ roundId: UUID, mode: "LIVE" }).success).toBe(true);
    expect(roundActionSchema.safeParse({ roundId: UUID, mode: "TEST" }).success).toBe(true);
    expect(roundActionSchema.safeParse({ roundId: UUID }).success).toBe(false);
    expect(roundActionSchema.safeParse({ roundId: UUID, mode: "REAL" }).success).toBe(false);
  });

  it("acota la duracion de la votacion", () => {
    expect(durationSchema.safeParse({ roundId: UUID, mode: "LIVE", seconds: 9 }).success).toBe(false);
    expect(durationSchema.safeParse({ roundId: UUID, mode: "LIVE", seconds: 10 }).success).toBe(true);
    expect(durationSchema.safeParse({ roundId: UUID, mode: "LIVE", seconds: 604800 }).success).toBe(true);
    expect(durationSchema.safeParse({ roundId: UUID, mode: "LIVE", seconds: 604801 }).success).toBe(false);
    expect(durationSchema.safeParse({ roundId: UUID, seconds: 60 }).success).toBe(false);
  });

  it("acota la cuenta atras de resultados", () => {
    expect(resultsCountdownSchema.safeParse({ roundId: UUID, mode: "LIVE", seconds: 4 }).success).toBe(
      false
    );
    expect(resultsCountdownSchema.safeParse({ roundId: UUID, mode: "LIVE", seconds: 5 }).success).toBe(
      true
    );
  });

  it("valida el formato del plazo de candidaturas", () => {
    expect(deadlineSchema.safeParse({ deadline: "2027-03-01T20:30" }).success).toBe(true);
    expect(deadlineSchema.safeParse({ deadline: null }).success).toBe(true);
    expect(deadlineSchema.safeParse({ deadline: "2027-03-01" }).success).toBe(false);
  });
});

describe("papeleta con opcion unificada", () => {
  it("acepta el identificador de una opcion congelada", () => {
    expect(voteSchema.safeParse({ roundId: UUID, optionId: UUID }).success).toBe(true);
  });

  it("rechaza las selecciones por tipo del modelo anterior", () => {
    expect(voteSchema.safeParse({ roundId: UUID, optionId: `member:${UUID}` }).success).toBe(false);
    expect(voteSchema.safeParse({ roundId: UUID, optionId: `candidacy:${UUID}` }).success).toBe(false);
    expect(voteSchema.safeParse({ roundId: UUID, selection: `member:${UUID}` }).success).toBe(false);
  });

  it("rechaza una papeleta sin opcion", () => {
    expect(voteSchema.safeParse({ roundId: UUID, optionId: "" }).success).toBe(false);
    expect(voteSchema.safeParse({ roundId: UUID }).success).toBe(false);
  });
});

describe("revision de candidaturas", () => {
  it("exige un motivo suficiente en la solicitud de correccion", () => {
    expect(
      correctionRequestSchema.safeParse({ candidacyId: UUID, reason: "Corrige la fecha de la cena." })
        .success
    ).toBe(true);
    expect(correctionRequestSchema.safeParse({ candidacyId: UUID, reason: "corto" }).success).toBe(false);
    expect(correctionRequestSchema.safeParse({ candidacyId: UUID, reason: "   " }).success).toBe(false);
  });

  it("solo admite validar o invalidar, nunca editar", () => {
    expect(reviewStatusSchema.safeParse({ candidacyId: UUID, status: "VALID" }).success).toBe(true);
    expect(reviewStatusSchema.safeParse({ candidacyId: UUID, status: "INVALID" }).success).toBe(true);
    expect(reviewStatusSchema.safeParse({ candidacyId: UUID, status: "EDITED" }).success).toBe(false);
  });
});

describe("fechas de calendario", () => {
  it("interpreta la fecha a medianoche UTC", () => {
    expect(parseCalendarDate("2027-06-12")?.toISOString()).toBe("2027-06-12T00:00:00.000Z");
  });

  it("rechaza formatos incorrectos", () => {
    expect(parseCalendarDate("12-06-2027")).toBeNull();
    expect(parseCalendarDate("2027-6-12")).toBeNull();
  });

  it("no desplaza el dia al ir y volver", () => {
    for (const value of ["2027-01-01", "2027-03-28", "2027-06-12", "2027-10-31", "2027-12-31"]) {
      const parsed = parseCalendarDate(value);
      expect(parsed).not.toBeNull();
      expect(toCalendarInputValue(parsed)).toBe(value);
    }
  });

  it("muestra el mismo dia que se guardo", () => {
    expect(formatCalendarDate(parseCalendarDate("2027-06-12"))).toBe("12 de junio de 2027");
  });
});

describe("instantes en hora de Madrid", () => {
  it("aplica el horario de verano", () => {
    expect(fromDateTimeLocalValue("2027-06-12T20:00")?.toISOString()).toBe("2027-06-12T18:00:00.000Z");
  });

  it("aplica el horario de invierno", () => {
    expect(fromDateTimeLocalValue("2027-01-15T20:00")?.toISOString()).toBe("2027-01-15T19:00:00.000Z");
  });

  it("rechaza un formato incorrecto", () => {
    expect(fromDateTimeLocalValue("2027-01-15 20:00")).toBeNull();
  });
});
