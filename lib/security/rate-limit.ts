import { prisma } from "@/lib/db/prisma";

/**
 * Rate limiting persistido en PostgreSQL.
 *
 * No se usa memoria del proceso porque en Vercel no es fiable entre
 * invocaciones. No se almacena IP ni user agent: solo el slug intentado.
 */

function maxAttempts(): number {
  const parsed = Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? "8", 10);
  if (Number.isNaN(parsed) || parsed < 3 || parsed > 100) return 8;
  return parsed;
}

function windowSeconds(): number {
  const parsed = Number.parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? "900", 10);
  if (Number.isNaN(parsed) || parsed < 60 || parsed > 86400) return 900;
  return parsed;
}

export interface RateLimitState {
  blocked: boolean;
  retryAfterSeconds: number;
}

export async function checkLoginRateLimit(slugKey: string): Promise<RateLimitState> {
  const since = new Date(Date.now() - windowSeconds() * 1000);

  const failures = await prisma.loginAttempt.findMany({
    where: { slugKey, success: false, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" }
  });

  if (failures.length < maxAttempts()) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const oldest = failures[0];
  const unblockAt = (oldest ? oldest.createdAt.getTime() : Date.now()) + windowSeconds() * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((unblockAt - Date.now()) / 1000));
  return { blocked: true, retryAfterSeconds };
}

export async function recordLoginAttempt(
  slugKey: string,
  success: boolean,
  memberId: string | null
): Promise<void> {
  await prisma.loginAttempt.create({
    data: { slugKey, success, memberId }
  });

  if (success) {
    await prisma.loginAttempt.deleteMany({ where: { slugKey, success: false } });
  }
}

/** Limpieza oportunista de intentos antiguos. */
export async function pruneOldLoginAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
