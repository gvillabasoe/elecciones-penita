import { redirect } from "next/navigation";
import type { Member } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { readSessionFromCookies } from "@/lib/auth/session";
import { AuthorizationError, isBoardRole } from "@/lib/authorization/board";

/**
 * Identidad del miembro autenticado.
 *
 * El rol se lee siempre de base de datos, no de la cookie. Manipular el
 * cliente no concede permisos.
 */

export type SessionMember = Pick<Member, "id" | "slug" | "displayName" | "role" | "isActive">;

export async function getCurrentMember(): Promise<SessionMember | null> {
  const session = await readSessionFromCookies();
  if (!session) return null;

  const member = await prisma.member.findUnique({
    where: { id: session.sub },
    select: { id: true, slug: true, displayName: true, role: true, isActive: true }
  });

  if (!member || !member.isActive) return null;
  return member;
}

/** Para Server Components: si no hay sesion valida, lleva a /login. */
export async function requireMember(): Promise<SessionMember> {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return member;
}

/** Para Server Components de la Junta Electoral. */
export async function requireBoardMember(): Promise<SessionMember> {
  const member = await requireMember();
  if (!isBoardRole(member.role)) redirect("/eleccion");
  return member;
}

/** Para Server Actions y Route Handlers: lanza en lugar de redirigir. */
export async function requireMemberOrThrow(): Promise<SessionMember> {
  const member = await getCurrentMember();
  if (!member) throw new AuthorizationError("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  return member;
}

export async function requireBoardMemberOrThrow(): Promise<SessionMember> {
  const member = await requireMemberOrThrow();
  if (!isBoardRole(member.role)) throw new AuthorizationError();
  return member;
}
