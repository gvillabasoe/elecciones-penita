import { Prisma } from "@prisma/client";

/**
 * Bloqueos a nivel de fila para serializar las transiciones electorales.
 *
 * Todas las acciones que cambian el estado de una ronda (iniciar, cerrar,
 * revelar, crear segunda vuelta, reiniciar) toman primero este bloqueo, de
 * modo que solo una peticion puede completar cada transicion.
 */

export async function lockRoundForUpdate(
  tx: Prisma.TransactionClient,
  roundId: string
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ElectionRound" WHERE "id" = ${roundId}::uuid FOR UPDATE`
  );
}

export async function lockElectionForUpdate(
  tx: Prisma.TransactionClient,
  electionId: string
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Election" WHERE "id" = ${electionId}::uuid FOR UPDATE`
  );
}

/** Hora del servidor de base de datos, unica referencia temporal valida. */
export async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const rows = await tx.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT NOW() AS "now"`);
  const first = rows[0];
  if (!first) return new Date();
  return first.now instanceof Date ? first.now : new Date(first.now);
}
