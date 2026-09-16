"use client";

import { useMemo, useState } from "react";
import { ModeBanner } from "@/components/election/ModeBanner";
import { ResultsBoard } from "@/components/results/ResultsBoard";
import { maskResults } from "@/lib/results/mask";
import {
  buildRankGroups,
  detectFirstPlaceTie,
  NEXT_STAGE,
  STAGE_LABELS,
  totalVotes,
  type RevealStage,
  type TallyEntry
} from "@/lib/results/ranking";

export interface ScenarioOption {
  key: string;
  label: string;
  description: string;
  entries: TallyEntry[];
}

/**
 * Ensayo de resultados con datos ficticios.
 *
 * Todo se calcula en memoria con las MISMAS funciones puras que la eleccion
 * real: mismo ranking, misma mascara por fases y mismos mensajes. No se leen
 * ni se escriben papeletas, participaciones ni auditoria reales.
 */
export function ScenarioPlayer({ scenarios }: { scenarios: ScenarioOption[] }) {
  const first = scenarios[0];
  const [scenarioKey, setScenarioKey] = useState(first ? first.key : "");
  const [stage, setStage] = useState<RevealStage>("HIDDEN");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const scenario = scenarios.find((item) => item.key === scenarioKey) ?? first;

  const results = useMemo(() => {
    if (!scenario) return null;
    const groups = buildRankGroups(scenario.entries);
    return maskResults({
      roundId: `simulacion-${scenario.key}`,
      roundNumber: 1,
      stage,
      groups,
      totalValidVotes: totalVotes(scenario.entries),
      participationCount: totalVotes(scenario.entries),
      ballotCount: totalVotes(scenario.entries)
    });
  }, [scenario, stage]);

  const tieInfo = useMemo(() => {
    if (!scenario) return null;
    if (stage !== "PODIUM_REVEALED") return null;
    return detectFirstPlaceTie(buildRankGroups(scenario.entries));
  }, [scenario, stage]);

  if (!scenario || !results) {
    return <p className="vacio">No hay escenarios disponibles.</p>;
  }

  const next = NEXT_STAGE[stage];

  const advance = () => {
    if (next) {
      setStage(next);
      setReplayKey((value) => value + 1);
    }
  };

  const reset = () => {
    setStage("HIDDEN");
    setReplayKey((value) => value + 1);
  };

  return (
    <div className="stack">
      <ModeBanner mode="TEST" />

      <section className="solido tarjeta stack stack--s">
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="escenario">
            Escenario ficticio
          </label>
          <select
            id="escenario"
            className="selector"
            value={scenario.key}
            onChange={(event) => {
              setScenarioKey(event.target.value);
              setStage("HIDDEN");
              setReplayKey((value) => value + 1);
            }}
          >
            {scenarios.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="campo__ayuda">{scenario.description}</span>
        </div>

        <div className="fila fila--separada">
          <span className="chip chip--neutro">{STAGE_LABELS[stage]}</span>
          <span className="chip chip--neutro texto-cifra">
            {scenario.entries.length} opciones ficticias
          </span>
        </div>

        <div className="fila">
          <button type="button" className="btn btn--principal" onClick={advance} disabled={next === null}>
            {next ? "Avanzar fase" : "Todas las fases publicadas"}
          </button>
          <button type="button" className="btn btn--fantasma" onClick={reset}>
            Reiniciar ensayo
          </button>
          <button
            type="button"
            className="btn btn--fantasma"
            onClick={() => setReplayKey((value) => value + 1)}
          >
            Repetir animación
          </button>
          <button
            type="button"
            className="btn btn--fantasma"
            aria-pressed={reducedMotion}
            onClick={() => setReducedMotion((value) => !value)}
          >
            {reducedMotion ? "Movimiento reducido: activo" : "Movimiento reducido: inactivo"}
          </button>
        </div>

        {tieInfo?.isTie ? (
          <p className="aviso">
            Empate en primera posición: en la elección real se habilitaría la segunda vuelta.
          </p>
        ) : null}
      </section>

      <div key={replayKey} className={reducedMotion ? "sin-animacion" : undefined}>
        {stage === "HIDDEN" ? (
          <p className="aviso">
            Nada publicado todavía. Avanza de fase para ensayar la publicación progresiva.
          </p>
        ) : (
          <ResultsBoard results={results} roundLabel="Simulación" />
        )}
      </div>
    </div>
  );
}
