import Link from "next/link";
import { ScenarioPlayer } from "@/components/board/ScenarioPlayer";
import { requireBoardMember } from "@/lib/auth/current-member";
import { SCENARIOS } from "@/lib/testing/scenarios";

export const dynamic = "force-dynamic";

/**
 * Ensayo de resultados con datos ficticios.
 *
 * Usa las mismas funciones puras de ranking y de máscara que la elección real,
 * pero sobre opciones inventadas calculadas en memoria: no lee papeletas
 * reales, no escribe en la auditoría real y no crea ninguna segunda vuelta.
 */
export default async function EnsayoResultadosPage() {
  await requireBoardMember();

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Ensayo de resultados</h1>
        <span className="chip chip--excluido">{SCENARIOS.length} escenarios</span>
      </div>

      <ScenarioPlayer
        scenarios={SCENARIOS.map((scenario) => ({
          key: scenario.key,
          label: scenario.label,
          description: scenario.description,
          entries: scenario.entries
        }))}
      />

      <Link href="/junta-electoral/pruebas" className="btn btn--fantasma btn--bloque">
        Volver a Pruebas
      </Link>
    </div>
  );
}
