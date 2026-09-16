import type { ElectionMode } from "@prisma/client";

/**
 * Etiquetas de modo.
 *
 * Modulo sin acceso a base de datos: lo consumen tambien componentes de
 * cliente (banda de aviso, stepper, simulacion).
 */

export type { ElectionMode };

export const MODE_LABELS: Record<ElectionMode, string> = {
  LIVE: "Elección real",
  TEST: "Modo de prueba"
};

export const TEST_MODE_BANNER =
  "MODO DE PRUEBA — Los datos mostrados no pertenecen a la elección real.";
