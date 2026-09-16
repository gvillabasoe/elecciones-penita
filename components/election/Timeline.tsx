import {
  PHASE_STATE_ICONS,
  PHASE_STATE_LABELS,
  type Timeline as TimelineData
} from "@/lib/election/timeline";
import { formatInstant } from "@/lib/time/format";

/**
 * Linea temporal de la eleccion.
 *
 * Cada fase muestra icono, texto y estado: nunca depende solo del color.
 * Version estatica, sin animaciones, legible a 320 px y sin scroll horizontal.
 */
export function Timeline({ timeline }: { timeline: TimelineData }) {
  return (
    <section className="cristal tarjeta stack stack--s" aria-labelledby="linea-temporal">
      <div className="seccion__titulo">
        <h2 id="linea-temporal" style={{ margin: 0 }}>
          Fases de la elección
        </h2>
      </div>

      <ol className="linea" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {timeline.phases.map((phase) => (
          <li key={phase.key} className={`linea__fase linea__fase--${phase.state.toLowerCase()}`}>
            <span className="linea__icono" aria-hidden="true">
              {PHASE_STATE_ICONS[phase.state]}
            </span>
            <span className="linea__cuerpo">
              <span className="linea__titulo">{phase.label}</span>
              <span className="linea__estado">{PHASE_STATE_LABELS[phase.state]}</span>
              {phase.detail ? <span className="texto-secundario">{phase.detail}</span> : null}
              {phase.atIso ? (
                <span className="texto-secundario texto-cifra">{formatInstant(phase.atIso)}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {timeline.nextAction ? (
        <p className="aviso" style={{ marginBottom: 0 }}>
          <strong>Próxima acción:</strong> {timeline.nextAction}
        </p>
      ) : null}
    </section>
  );
}
