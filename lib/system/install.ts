import { randomInt } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import {
  CANONICAL_MEMBERS,
  ELECTION_NAME,
  ELECTION_SLUG,
  ELECTION_TEST_NAME,
  ELECTION_TEST_SLUG,
  MEMBER_COUNT
} from "@/lib/members";
import { normalizeName } from "@/lib/validation/normalize";

/**
 * Instalacion desde el navegador.
 *
 * Hace lo mismo que `npm run seed`, pero sin necesitar un entorno local: crea
 * los 39 miembros con el hash bcrypt de su contrasena inicial, las dos
 * elecciones (real y de ensayo) con su primera vuelta y el censo completo.
 *
 * Garantias:
 *  - Solo funciona con la tabla de miembros VACIA. Nunca sobrescribe una
 *    instalacion existente, y por tanto nunca puede cambiar contrasenas ya en
 *    uso ni tocar una eleccion en marcha.
 *  - Las contrasenas en claro no se guardan, ni se registran, ni se devuelven
 *    salvo las que genera este modulo, y solo en la respuesta de esa peticion.
 *  - Los hashes se calculan FUERA de la transaccion: bcrypt con coste 12 son
 *    varios segundos de CPU y una transaccion abierta ese tiempo se agotaria.
 */

export class InstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstallError";
  }
}

export const MIN_PASSWORD_LENGTH = 6;

/** Alfabeto sin caracteres ambiguos: ni 0/O ni 1/l/I. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
const GENERATED_LENGTH = 10;

function randomPassword(): string {
  let value = "";
  for (let index = 0; index < GENERATED_LENGTH; index += 1) {
    value += ALPHABET[randomInt(ALPHABET.length)];
  }
  return value;
}

/** Una contrasena aleatoria por miembro. Se muestran una sola vez. */
export function generatePasswords(): Map<string, string> {
  return new Map(CANONICAL_MEMBERS.map((member) => [member.slug, randomPassword()]));
}

/** Plantilla que se muestra en el panel: un JSON con los 39 identificadores. */
export function credentialsTemplate(): string {
  const body = CANONICAL_MEMBERS.map((member) => `  "${member.slug}": ""`).join(",\n");
  return `{\n${body}\n}`;
}

/**
 * Interpreta las contrasenas escritas a mano. Acepta un objeto JSON
 * {"slug": "contrasena"} y tambien una lista de lineas "slug: contrasena".
 */
export function parseCredentials(raw: string): Map<string, string> {
  const valid = new Set(CANONICAL_MEMBERS.map((member) => member.slug));
  const result = new Map<string, string>();
  const unknown: string[] = [];

  const add = (rawSlug: string, rawPassword: unknown) => {
    const slug = rawSlug.trim().toLowerCase();
    if (slug.length === 0 || slug.startsWith("_")) return;
    if (!valid.has(slug)) {
      unknown.push(slug);
      return;
    }
    if (typeof rawPassword !== "string") {
      throw new InstallError(`La contraseña de ${slug} no es un texto.`);
    }
    const password = rawPassword.trim();
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new InstallError(
        `La contraseña de ${slug} tiene menos de ${MIN_PASSWORD_LENGTH} caracteres.`
      );
    }
    result.set(slug, password);
  };

  const text = raw.trim();

  if (text.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new InstallError("El JSON de contraseñas no es válido: revisa comas y comillas.");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new InstallError("El JSON de contraseñas debe ser un objeto.");
    }
    for (const [slug, password] of Object.entries(parsed as Record<string, unknown>)) {
      add(slug, password);
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
      const separator = trimmed.search(/[:=]/);
      if (separator <= 0) {
        throw new InstallError(
          `No se entiende esta línea: "${trimmed.slice(0, 40)}". Usa "identificador: contraseña".`
        );
      }
      add(trimmed.slice(0, separator), trimmed.slice(separator + 1));
    }
  }

  if (unknown.length > 0) {
    throw new InstallError(`Estos identificadores no existen: ${unknown.slice(0, 5).join(", ")}.`);
  }

  return result;
}

export interface InstallResult {
  members: number;
  elections: number;
  eligibilities: number;
}

export async function installDatabase(credentials: Map<string, string>): Promise<InstallResult> {
  if (CANONICAL_MEMBERS.length !== MEMBER_COUNT) {
    throw new InstallError(`La lista canónica debe tener ${MEMBER_COUNT} miembros.`);
  }

  const missing = CANONICAL_MEMBERS.filter((member) => !credentials.has(member.slug));
  if (missing.length > 0) {
    throw new InstallError(
      `Faltan ${missing.length} contraseñas. La primera sin asignar es "${missing[0]?.slug}".`
    );
  }

  const already = await prisma.member.count();
  if (already > 0) {
    throw new InstallError(
      `La base de datos ya tiene ${already} miembros. La instalación web solo puede ejecutarse sobre una base vacía.`
    );
  }

  // bcrypt es costoso a proposito: fuera de la transaccion.
  const rows = [];
  for (const member of CANONICAL_MEMBERS) {
    const plain = credentials.get(member.slug);
    if (!plain) throw new InstallError(`Falta la contraseña de ${member.slug}.`);
    rows.push({
      slug: member.slug,
      displayName: member.displayName,
      normalizedName: normalizeName(member.displayName),
      sortOrder: member.sortOrder,
      role: member.role,
      isActive: true,
      passwordHash: await hashPassword(plain)
    });
  }

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.member.count();
      if (existing > 0) {
        throw new InstallError("Otra instalación se ha completado mientras esta estaba en curso.");
      }

      await tx.member.createMany({ data: rows });
      const members = await tx.member.findMany({ select: { id: true } });

      const definitions = [
        { mode: "LIVE" as const, slug: ELECTION_SLUG, name: ELECTION_NAME },
        { mode: "TEST" as const, slug: ELECTION_TEST_SLUG, name: ELECTION_TEST_NAME }
      ];

      let eligibilities = 0;

      for (const definition of definitions) {
        const election = await tx.election.upsert({
          where: { slug: definition.slug },
          create: { slug: definition.slug, name: definition.name, mode: definition.mode },
          update: { name: definition.name },
          select: { id: true, mode: true }
        });

        if (election.mode !== definition.mode) {
          throw new InstallError(
            `La elección ${definition.slug} ya existe con modo ${election.mode}: el modo es inmutable.`
          );
        }

        const round = await tx.electionRound.findFirst({
          where: { electionId: election.id, roundNumber: 1 },
          select: { id: true }
        });

        if (!round) {
          await tx.electionRound.create({
            data: {
              electionId: election.id,
              mode: definition.mode,
              roundNumber: 1,
              status: "READY_TO_START"
            }
          });
        }

        const created = await tx.electionEligibility.createMany({
          data: members.map((member) => ({
            electionId: election.id,
            memberId: member.id,
            isEligible: true
          })),
          skipDuplicates: true
        });
        eligibilities += created.count;
      }

      return { members: rows.length, elections: definitions.length, eligibilities };
    },
    { timeout: 20000, maxWait: 10000 }
  );
}
