import { describe, expect, it } from "vitest";
import { CANONICAL_MEMBERS } from "@/lib/members";
import { matchesQuery, normalizeText } from "@/lib/validation/normalize";

function buscar(query: string): string[] {
  return CANONICAL_MEMBERS.filter((member) => matchesQuery(member.displayName, query)).map(
    (member) => member.displayName
  );
}

describe("normalizacion de texto", () => {
  it("quita tildes y dieresis", () => {
    expect(normalizeText("Álvaro")).toBe("alvaro");
    expect(normalizeText("Basáñez")).toBe("basanez");
    expect(normalizeText("Zumárraga")).toBe("zumarraga");
  });

  it("trata la ene como n", () => {
    expect(normalizeText("Iñigo")).toBe("inigo");
  });

  it("elimina comillas y guiones", () => {
    expect(normalizeText('"Pacho" Rodríguez-Rey')).toBe("pacho rodriguez rey");
  });

  it("colapsa los espacios", () => {
    expect(normalizeText("  Juan   Cancio  ")).toBe("juan cancio");
  });
});

describe("busqueda de miembros", () => {
  it("encuentra a Alvaro Goyoaga sin tilde", () => {
    expect(buscar("alvaro")).toContain("Álvaro Goyoaga");
  });

  it("encuentra a Inigo Gomeza sin ene", () => {
    expect(buscar("inigo")).toContain("Iñigo Gomeza");
  });

  it("encuentra a Pacho por el apodo entre comillas", () => {
    expect(buscar("pacho")).toEqual(['"Pacho" Rodríguez-Rey']);
  });

  it("encuentra a Pacho por el apellido compuesto sin guion", () => {
    expect(buscar("rodriguez rey")).toEqual(['"Pacho" Rodríguez-Rey']);
  });

  it("encuentra a Diego Zumarraga sin tilde", () => {
    expect(buscar("zumarraga")).toContain("Diego Zumárraga");
  });

  it("encuentra a Alejo de Sarria sin tilde", () => {
    expect(buscar("sarria")).toContain("Alejo de Sarría");
  });

  it("encuentra a Joaquin Ascarza escrito con tilde", () => {
    expect(buscar("joaquín")).toContain("Joaquin Ascarza");
  });

  it("admite fragmentos en cualquier orden", () => {
    expect(buscar("goyoaga alvaro")).toContain("Álvaro Goyoaga");
  });

  it("devuelve la lista completa con la consulta vacia", () => {
    expect(buscar("")).toHaveLength(CANONICAL_MEMBERS.length);
  });

  it("no devuelve nada con una consulta inexistente", () => {
    expect(buscar("zzzz")).toEqual([]);
  });
});

describe("lista canonica", () => {
  it("tiene 39 miembros", () => {
    expect(CANONICAL_MEMBERS).toHaveLength(39);
  });

  it("no repite slug ni posicion", () => {
    expect(new Set(CANONICAL_MEMBERS.map((member) => member.slug)).size).toBe(39);
    expect(new Set(CANONICAL_MEMBERS.map((member) => member.sortOrder)).size).toBe(39);
  });

  it("numera las posiciones de 1 a 39", () => {
    const orden = CANONICAL_MEMBERS.map((member) => member.sortOrder).sort((a, b) => a - b);
    expect(orden).toEqual(Array.from({ length: 39 }, (_, index) => index + 1));
  });

  it("asigna los dos roles de la Junta Electoral", () => {
    const junta = CANONICAL_MEMBERS.filter((member) => member.role !== "MEMBER");
    expect(junta).toHaveLength(2);
    expect(junta.find((member) => member.role === "PRESIDENT")?.displayName).toBe("Iñigo Gomeza");
    expect(junta.find((member) => member.role === "HONORARY_PRESIDENT")?.displayName).toBe(
      "Gonzalo Villabaso"
    );
  });

  it("conserva las grafias exactas", () => {
    const nombres = CANONICAL_MEMBERS.map((member) => member.displayName);
    expect(nombres).toContain('"Pacho" Rodríguez-Rey');
    expect(nombres).toContain("Joaquin Ascarza");
    expect(nombres).toContain("Alejo de Sarría");
  });
});
