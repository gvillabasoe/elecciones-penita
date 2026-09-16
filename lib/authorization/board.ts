import type { Role } from "@prisma/client";

/**
 * La Junta Electoral se deriva SIEMPRE del rol almacenado en base de datos,
 * nunca del nombre visible del miembro.
 */

export const BOARD_ROLES: readonly Role[] = ["PRESIDENT", "HONORARY_PRESIDENT"];

export function isBoardRole(role: Role): boolean {
  return BOARD_ROLES.includes(role);
}

export class AuthorizationError extends Error {
  constructor(message = "No tienes permisos para realizar esta acción.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertBoardRole(role: Role): void {
  if (!isBoardRole(role)) throw new AuthorizationError();
}
