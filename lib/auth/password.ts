import { compare, hash } from "bcryptjs";

/**
 * Hash de contrasenas con bcrypt.
 * Nunca se guarda, imprime ni registra la contrasena en claro.
 */

function cost(): number {
  const parsed = Number.parseInt(process.env.BCRYPT_COST ?? "12", 10);
  if (Number.isNaN(parsed) || parsed < 10 || parsed > 15) return 12;
  return parsed;
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, cost());
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  try {
    return await compare(plainPassword, passwordHash);
  } catch {
    return false;
  }
}

/**
 * Hash senuelo calculado con el mismo coste y cacheado en memoria.
 * Se usa cuando el miembro no existe, esta inactivo o no tiene hash, para que
 * el tiempo de respuesta del login no revele nada.
 */
let dummyHashPromise: Promise<string> | null = null;

export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash("identidad-inexistente-en-la-penita", cost());
  }
  return dummyHashPromise;
}
