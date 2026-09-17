/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import {
  CANONICAL_MEMBERS,
  ELECTION_NAME,
  ELECTION_SLUG,
  ELECTION_TEST_NAME,
  ELECTION_TEST_SLUG,
  MEMBER_COUNT
} from "../lib/members";
import { normalizeName } from "../lib/validation/normalize";

/**
 * Seed de la aplicacion.
 *
 * Las contrasenas iniciales NO viven en el repositorio. Este script lee un
 * La misma carga existe en lib/system/install.ts, para la instalacion desde el
 * navegador. Si cambias una, cambia la otra.
 *
 * archivo JSON externo (por defecto prisma/credentials.local.json, ignorado
 * por git), calcula el hash bcrypt y descarta inmediatamente el texto plano.
 *
 * El script nunca imprime una contrasena.
 */

const prisma = new PrismaClient();

type CredentialsFile = Record<string, unknown>;

function loadCredentials(): Map<string, string> {
  const relativePath = process.env.SEED_CREDENTIALS_FILE ?? "prisma/credentials.local.json";
  const absolutePath = path.resolve(process.cwd(), relativePath);

  let parsed: CredentialsFile;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as CredentialsFile;
  } catch {
    console.error(
      [
        `No se ha podido leer el archivo de credenciales: ${relativePath}`,
        "",
        "Crea el archivo a partir de la plantilla y vuelve a ejecutar el seed:",
        "  cp prisma/credentials.example.json prisma/credentials.local.json",
        "",
        "Rellena cada slug con la contrasena inicial del miembro. El archivo",
        "esta en .gitignore y no debe subirse nunca al repositorio."
      ].join("\n")
    );
    process.exit(1);
  }

  const credentials = new Map<string, string>();
  for (const [slug, value] of Object.entries(parsed)) {
    if (slug.startsWith("_")) continue;
    if (typeof value !== "string" || value.trim().length === 0) continue;
    credentials.set(slug, value);
  }

  return credentials;
}

async function main(): Promise<void> {
  if (CANONICAL_MEMBERS.length !== MEMBER_COUNT) {
    throw new Error(`La lista canonica debe tener ${MEMBER_COUNT} miembros.`);
  }

  const credentials = loadCredentials();
  const missing = CANONICAL_MEMBERS.filter((member) => !credentials.has(member.slug)).map((m) => m.slug);

  const existing = await prisma.member.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existing.map((row) => row.slug));
  const blocking = missing.filter((slug) => !existingSlugs.has(slug));

  if (blocking.length > 0) {
    console.error("Faltan credenciales iniciales para estos miembros:");
    for (const slug of blocking) console.error(`  - ${slug}`);
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (const member of CANONICAL_MEMBERS) {
    const plainPassword = credentials.get(member.slug);
    const passwordHash = plainPassword ? await hashPassword(plainPassword) : null;

    const base = {
      displayName: member.displayName,
      normalizedName: normalizeName(member.displayName),
      sortOrder: member.sortOrder,
      role: member.role,
      isActive: true
    };

    const wasPresent = existingSlugs.has(member.slug);

    await prisma.member.upsert({
      where: { slug: member.slug },
      create: {
        slug: member.slug,
        ...base,
        passwordHash: passwordHash ?? ""
      },
      update: passwordHash ? { ...base, passwordHash } : base
    });

    if (wasPresent) updated += 1;
    else created += 1;
  }

  // Dos elecciones con modo definido: la real y la de ensayo. Sus datos nunca
  // se mezclan; la eleccion de prueba es de uso exclusivo de la Junta.
  const modes = [
    { mode: "LIVE" as const, slug: ELECTION_SLUG, name: ELECTION_NAME },
    { mode: "TEST" as const, slug: ELECTION_TEST_SLUG, name: ELECTION_TEST_NAME }
  ];

  const members = await prisma.member.findMany({ select: { id: true } });
  const summary: string[] = [];

  for (const entry of modes) {
    const election = await prisma.election.upsert({
      where: { slug: entry.slug },
      create: { slug: entry.slug, name: entry.name, mode: entry.mode },
      update: { name: entry.name },
      select: { id: true, mode: true }
    });

    if (election.mode !== entry.mode) {
      throw new Error(
        `La eleccion ${entry.slug} existe con modo ${election.mode}: el modo es inmutable. ` +
          "Revisa la base de datos antes de continuar."
      );
    }

    const firstRound = await prisma.electionRound.findFirst({
      where: { electionId: election.id, roundNumber: 1 },
      select: { id: true }
    });

    if (!firstRound) {
      await prisma.electionRound.create({
        data: {
          electionId: election.id,
          mode: entry.mode,
          roundNumber: 1,
          status: "READY_TO_START"
        }
      });
    }

    for (const member of members) {
      await prisma.electionEligibility.upsert({
        where: { electionId_memberId: { electionId: election.id, memberId: member.id } },
        create: { electionId: election.id, memberId: member.id, isEligible: true },
        update: {}
      });
    }

    summary.push(
      `  ${entry.mode}: ${entry.name} - primera vuelta ${firstRound ? "ya existia" : "creada"}`
    );
  }

  const boardCount = await prisma.member.count({
    where: { role: { in: ["PRESIDENT", "HONORARY_PRESIDENT"] } }
  });

  console.log("Seed completado.");
  console.log(`  Miembros creados: ${created}`);
  console.log(`  Miembros actualizados: ${updated}`);
  console.log(`  Junta Electoral: ${boardCount} miembros`);
  for (const line of summary) console.log(line);
  console.log("");
  console.log("Recuerda borrar el archivo de credenciales cuando ya no lo necesites.");
}

main()
  .catch((error) => {
    console.error("El seed ha fallado:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
