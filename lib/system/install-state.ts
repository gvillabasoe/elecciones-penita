/**
 * Estado de las acciones de instalacion.
 *
 * Vive aparte de lib/system/install.ts a proposito: ese modulo crea un cliente
 * de Prisma y usa node:crypto, asi que no puede entrar en el paquete del
 * navegador. El panel de instalacion es un componente de cliente y solo
 * necesita estos tipos.
 */

export interface InstalledPassword {
  displayName: string;
  slug: string;
  password: string;
}

export interface InstallActionState {
  error: string | null;
  success: string | null;
  /** Detalle tecnico, sin secretos. */
  detail: string[];
  /**
   * Contrasenas generadas, devueltas UNA SOLA VEZ para que el usuario las
   * copie. No se guardan en ningun sitio: en base de datos solo hay hashes.
   */
  passwords: InstalledPassword[];
}

export const EMPTY_INSTALL_STATE: InstallActionState = {
  error: null,
  success: null,
  detail: [],
  passwords: []
};
