import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MIGRATION_SCRIPTS } from "@/lib/system/install-sql.generated";

/**
 * Creacion del esquema desde el navegador.
 *
 * Ejecuta las mismas migraciones que `prisma migrate deploy` y las registra en
 * "_prisma_migrations" con su checksum real, de modo que la CLI de Prisma las
 * considere aplicadas y nunca intente repetirlas.
 *
 * Cada migracion va en su propia transaccion: si una falla, no deja nada a
 * medias y las anteriores quedan aplicadas y anotadas. Es idempotente, porque
 * antes de ejecutar comprueba lo ya registrado.
 */

export class SchemaInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaInstallError";
  }
}

export interface SchemaInstallResult {
  applied: string[];
  skipped: string[];
  statements: number;
}

const BOOKKEEPING_TABLE = `
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  )
`;

async function appliedMigrations(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ migration_name: string }[]>(Prisma.sql`
    SELECT "migration_name"
    FROM "_prisma_migrations"
    WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
  `);
  return new Set(rows.map((row) => row.migration_name));
}

export async function installSchema(): Promise<SchemaInstallResult> {
  await prisma.$executeRawUnsafe(BOOKKEEPING_TABLE);

  const done = await appliedMigrations();
  const applied: string[] = [];
  const skipped: string[] = [];
  let statements = 0;

  for (const migration of MIGRATION_SCRIPTS) {
    if (done.has(migration.name)) {
      skipped.push(migration.name);
      continue;
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          for (const statement of migration.statements) {
            await tx.$executeRawUnsafe(statement);
          }

          await tx.$executeRaw(Prisma.sql`
            INSERT INTO "_prisma_migrations"
              ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
            VALUES (
              gen_random_uuid()::text,
              ${migration.checksum},
              now(),
              ${migration.name},
              now(),
              ${migration.statements.length}
            )
          `);
        },
        { timeout: 45000, maxWait: 15000 }
      );
    } catch (error) {
      const detalle = error instanceof Error ? error.message.split("\n")[0] : "";
      throw new SchemaInstallError(
        `La migración ${migration.name} no se ha podido aplicar. No se ha dejado nada a medias. ${detalle ?? ""}`.trim()
      );
    }

    applied.push(migration.name);
    statements += migration.statements.length;
  }

  return { applied, skipped, statements };
}
