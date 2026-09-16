/**
 * Resultado uniforme de las acciones de la interfaz.
 *
 * Vive fuera de los archivos "use server" a propósito: los componentes de
 * cliente necesitan este tipo y un archivo de Server Actions solo debería
 * exportar funciones asíncronas.
 */

export interface BoardActionState {
  error: string | null;
  success: string | null;
}

/** Alias histórico: mismo contrato. */
export type BoardActionResult = BoardActionState;

export interface CandidacyActionState {
  error: string | null;
  success: string | null;
  candidacyId: string | null;
}
