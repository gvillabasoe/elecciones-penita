#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Genera, a partir de prisma/migrations, los dos artefactos que permiten
 * instalar el esquema sin entorno local:
 *
 *   1. prisma/instalacion-neon.sql       -> para pegar en el editor SQL de Neon
 *   2. lib/system/install-sql.generated.ts -> para la pagina /instalacion
 *
 * Ambos incluyen el checksum SHA-256 real de cada migracion, de modo que un
 * futuro `prisma migrate deploy` las considere aplicadas y no las repita.
 */

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "prisma", "migrations");

const EXPECTED_TABLES = [
  "Member",
  "Election",
  "ElectionRound",
  "ElectionEligibility",
  "Candidacy",
  "RoundBallotOption",
  "VotingParticipation",
  "Ballot",
  "ElectionAuditLog"
];

/**
 * Separa un script en sentencias respetando comentarios, cadenas y bloques
 * con dolares ($$ ... $$). Partir dentro de un $$ rompe los disparadores.
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let index = 0;
  let lineComment = false;
  let blockComment = false;
  let single = false;
  let dollarTag = null;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      index += 1;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 2;
        blockComment = false;
        continue;
      }
      index += 1;
      continue;
    }
    if (single) {
      current += char;
      if (char === "'") {
        if (next === "'") {
          current += next;
          index += 2;
          continue;
        }
        single = false;
      }
      index += 1;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += char;
      index += 1;
      continue;
    }

    if (char === "-" && next === "-") {
      lineComment = true;
      current += char;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      current += char;
      index += 1;
      continue;
    }
    if (char === "'") {
      single = true;
      current += char;
      index += 1;
      continue;
    }

    const dollar = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(index));
    if (dollar) {
      dollarTag = dollar[0];
      current += dollarTag;
      index += dollarTag.length;
      continue;
    }

    if (char === ";") {
      statements.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  if (current.trim().length > 0) statements.push(current.trim());

  // Fuera los fragmentos que solo son comentarios.
  return statements.filter((statement) => statement.replace(/--[^\n]*/g, "").trim().length > 0);
}

const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => {
    const sql = readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
    return {
      name,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
      statements: splitStatements(sql)
    };
  });

// --------------------------------------------------------------- 1. SQL plano

const bookkeeping = [
  'CREATE TABLE IF NOT EXISTS "_prisma_migrations" (',
  '    "id" VARCHAR(36) PRIMARY KEY NOT NULL,',
  '    "checksum" VARCHAR(64) NOT NULL,',
  '    "finished_at" TIMESTAMPTZ,',
  '    "migration_name" VARCHAR(255) NOT NULL,',
  '    "logs" TEXT,',
  '    "rolled_back_at" TIMESTAMPTZ,',
  '    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),',
  '    "applied_steps_count" INTEGER NOT NULL DEFAULT 0',
  ");"
];

const sqlParts = [
  "-- ---------------------------------------------------------------------------",
  "-- Elecciones a la Presidencia de la Penita 2027",
  "-- Instalacion del esquema para el editor SQL de Neon.",
  "--",
  "-- Uso: Neon -> tu proyecto -> SQL Editor -> pega todo -> Run.",
  "-- Equivale a `npm run prisma:deploy`. NO carga miembros: eso lo hace",
  "-- `npm run seed` o el paso 2 de la pagina /instalacion.",
  "--",
  "-- ARCHIVO GENERADO con: npm run build:install-sql",
  `-- Migraciones incluidas (${migrations.length}):`,
  ...migrations.map((migration) => `--   ${migration.name}`),
  "-- ---------------------------------------------------------------------------",
  "",
  "BEGIN;",
  "",
  ...bookkeeping,
  ""
];

for (const migration of migrations) {
  sqlParts.push(
    "-- ===========================================================================",
    `-- ${migration.name}`,
    "-- ===========================================================================",
    "",
    migration.sql.trimEnd(),
    "",
    'INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")',
    `VALUES (gen_random_uuid()::text, '${migration.checksum}', now(), '${migration.name}', now(), ${migration.statements.length})`,
    "ON CONFLICT DO NOTHING;",
    ""
  );
}

sqlParts.push(
  "COMMIT;",
  "",
  "-- Comprobacion: debe devolver 9.",
  'SELECT COUNT(*) AS "tablas_creadas"',
  "FROM information_schema.tables",
  "WHERE table_schema = 'public'",
  `  AND table_name IN (${EXPECTED_TABLES.map((table) => `'${table}'`).join(", ")});`,
  ""
);

const sqlFile = path.join(root, "prisma", "instalacion-neon.sql");
writeFileSync(sqlFile, sqlParts.join("\n"), "utf8");

// ------------------------------------------------------ 2. Modulo TypeScript

const tsParts = [
  "// ARCHIVO GENERADO. No editar a mano.",
  "// Se produce con: npm run build:install-sql",
  "// Fuente: prisma/migrations/*/migration.sql",
  "",
  "export interface MigrationScript {",
  "  /** Nombre de la carpeta de la migracion, tal y como lo guarda Prisma. */",
  "  name: string;",
  "  /** SHA-256 del archivo migration.sql, igual que el del motor de migraciones. */",
  "  checksum: string;",
  "  /** Sentencias individuales, en orden. */",
  "  statements: string[];",
  "}",
  "",
  "export const MIGRATION_SCRIPTS: MigrationScript[] = [",
  ...migrations.flatMap((migration) => [
    "  {",
    `    name: ${JSON.stringify(migration.name)},`,
    `    checksum: ${JSON.stringify(migration.checksum)},`,
    "    statements: [",
    ...migration.statements.map((statement) => `      ${JSON.stringify(statement)},`),
    "    ]",
    "  },"
  ]),
  "];",
  ""
];

const tsFile = path.join(root, "lib", "system", "install-sql.generated.ts");
writeFileSync(tsFile, tsParts.join("\n"), "utf8");

console.log(`Generado ${path.relative(root, sqlFile)}`);
console.log(`Generado ${path.relative(root, tsFile)}`);
for (const migration of migrations) {
  console.log(`  ${migration.name}: ${migration.statements.length} sentencias`);
}
