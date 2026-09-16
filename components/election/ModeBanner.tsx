import { TEST_MODE_BANNER, type ElectionMode } from "@/lib/election/mode";

/**
 * Banda permanente de modo de prueba.
 *
 * Se muestra en cabecera, dashboard, pantallas de simulacion, resultados
 * simulados y confirmaciones destructivas. No depende de transparencias ni de
 * animaciones: superficie solida y texto explicito.
 */
export function ModeBanner({ mode }: { mode: ElectionMode }) {
  if (mode !== "TEST") return null;

  return (
    <p className="banda-prueba" role="status">
      <span aria-hidden="true">⚠</span> {TEST_MODE_BANNER}
    </p>
  );
}
