import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma unico.
 * En desarrollo se reutiliza entre recargas para no agotar conexiones de Neon.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
