"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/security/rate-limit";

/**
 * Inicio de sesion.
 *
 * El mensaje de error es siempre el mismo: no revela si el nombre existe,
 * si la contrasena es incorrecta, si la cuenta esta inactiva ni si falta el
 * hash. El tiempo de respuesta tampoco lo revela, porque siempre se compara
 * contra un hash con el mismo coste.
 */

const MENSAJE_GENERICO = "Nombre o contraseña incorrectos.";

export interface LoginState {
  error: string | null;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (slug.length === 0) return { error: "Selecciona tu nombre." };
  if (password.length === 0) return { error: "Introduce tu contraseña." };

  const limit = await checkLoginRateLimit(slug);
  if (limit.blocked) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return { error: `Demasiados intentos. Vuelve a probar en ${minutes} minuto${minutes === 1 ? "" : "s"}.` };
  }

  const member = await prisma.member.findUnique({
    where: { slug },
    select: { id: true, slug: true, passwordHash: true, isActive: true }
  });

  const hash = member && member.passwordHash.length > 0 ? member.passwordHash : await getDummyHash();
  const passwordMatches = await verifyPassword(password, hash);
  const allowed = Boolean(member) && member!.isActive && member!.passwordHash.length > 0 && passwordMatches;

  await recordLoginAttempt(slug, allowed, member?.id ?? null);

  if (!allowed || !member) {
    return { error: MENSAJE_GENERICO };
  }

  await setSessionCookie(member.id, member.slug);
  redirect("/eleccion");
}
