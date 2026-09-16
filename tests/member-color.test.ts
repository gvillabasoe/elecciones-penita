import { describe, expect, it } from "vitest";
import { memberOptionColor, stableHash } from "@/lib/theme/member-color";
import { CANONICAL_MEMBERS } from "@/lib/members";

describe("color determinista de miembro", () => {
  it("devuelve siempre el mismo color para el mismo miembro", () => {
    const first = memberOptionColor("pablo-antepara");
    for (let index = 0; index < 20; index += 1) {
      expect(memberOptionColor("pablo-antepara")).toBe(first);
    }
  });

  it("devuelve un hexadecimal valido", () => {
    for (const member of CANONICAL_MEMBERS) {
      expect(memberOptionColor(member.slug)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("distingue miembros distintos en la mayoria de los casos", () => {
    const colores = new Set(CANONICAL_MEMBERS.map((member) => memberOptionColor(member.slug)));
    expect(colores.size).toBeGreaterThan(CANONICAL_MEMBERS.length * 0.75);
  });

  it("el hash es estable y positivo", () => {
    expect(stableHash("a")).toBe(stableHash("a"));
    expect(stableHash("a")).not.toBe(stableHash("b"));
    expect(stableHash("iñigo-gomeza")).toBeGreaterThanOrEqual(0);
  });
});
