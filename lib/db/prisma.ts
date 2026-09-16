import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma unico y PEREZOSO.
 *
 * El cliente se construye en el primer uso real, no al importar el modulo.
 * Es deliberado: si falta DATABASE_URL, el constructor de Prisma lanza, y con
 * una construccion inmediata cualquier pagina que importe este modulo moriria
 * antes de poder capturar el error y explicar que falta configurar. Asi el
 * fallo ocurre dentro de la consulta, donde si podemos tratarlo.
 *
 * Se reutiliza a traves de globalThis para no agotar las conexiones de Neon
 * entre recargas en desarrollo y entre invocaciones de la misma instancia en
 * produccion.
 */

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }
  return globalForPrisma.prismaClient;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client as object, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return property in (getClient() as object);
  },
  getPrototypeOf() {
    return PrismaClient.prototype;
  }
});
