import { Podium } from "@/components/results/Podium";
import { positionLabel } from "@/lib/results/ranking";
import type { PublishedResults } from "@/lib/results/published";

interface Props {
  results: PublishedResults;
  /** Etiqueta de la ronda, para no mezclar rondas en pantalla. */
  roundLabel: string;
}

function formatPercentage(value: number): string {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/**
 * Escrutinio.
 *
 * Recibe SOLO los grupos ya publicados: el enmascarado se aplica en servidor.
 * Cada fila representa a un miembro, con su candidatura integrada cuando
 * existe. Nunca se muestran dos contadores para el mismo miembro.
 */
export function ResultsBoard({ results, roundLabel }: Props) {
  if (results.stage === "HIDDEN") return null;

  const podiumRevealed = results.stage === "PODIUM_REVEALED";
  const nonPodium = results.groups.filter((group) => group.position >= 4);
  const rows = nonPodium.flatMap((group) => group.options.map((option) => ({ group, option })));
  const total = results.totalValidVotes ?? 0;
  const maxVotes = Math.max(1, ...results.groups.map((group) => group.votes));

  return (
    <div className="stack">
      {podiumRevealed && results.podium.length > 0 ? (
        <section className="solido tarjeta stack" aria-label={`Podio · ${roundLabel}`}>
          <div className="seccion__titulo">
            <h2>Podio</h2>
            <span className="texto-secundario texto-cifra">{total} votos válidos</span>
          </div>

          <Podium
            groups={results.podium}
            totalValidVotes={total}
            tie={results.firstPlaceTie?.isTie ?? false}
          />
        </section>
      ) : null}

      {results.notices.length > 0 ? (
        <div className="stack stack--s">
          {results.notices.map((notice) => (
            <p key={notice} className="aviso" style={{ marginBottom: 0 }}>
              {notice}
            </p>
          ))}
        </div>
      ) : null}

      <section className="solido tarjeta" aria-label={`Resultados · ${roundLabel}`}>
        <div className="seccion__titulo">
          <h2>{podiumRevealed ? "Resto de resultados" : "Resultados"}</h2>
          <span className="texto-secundario texto-cifra">
            {total} voto{total === 1 ? "" : "s"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="vacio">
            {podiumRevealed
              ? "Todas las opciones con votos están en el podio."
              : "Todas las opciones de esta fase ya se han revelado."}
          </p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map(({ group, option }, index) => {
              // La animacion entra de menos a mas votos. Si no hay animaciones,
              // el orden y los numeros siguen siendo correctos.
              const delay = (rows.length - 1 - index) * 90;
              return (
                <li
                  key={option.optionId}
                  className="resultado"
                  style={
                    {
                      "--retardo": `${delay}ms`,
                      "--color-opcion": option.color
                    } as React.CSSProperties
                  }
                >
                  <span className="resultado__posicion texto-cifra">
                    {positionLabel(group.position)}
                  </span>
                  <span>
                    <span className="resultado__nombre">{option.memberName}</span>
                    <span className="resultado__meta" style={{ display: "block" }}>
                      {option.hasFormalCandidacy ? "Con candidatura" : "Sin candidatura formal"}
                      {option.candidacyName ? ` · ${option.candidacyName}` : ""}
                      {group.options.length > 1 ? " · Empate" : ""}
                    </span>
                    {option.slogan ? (
                      <span className="resultado__meta" style={{ display: "block", fontStyle: "italic" }}>
                        {option.slogan}
                      </span>
                    ) : null}
                  </span>
                  <span className="resultado__cifras">
                    <span className="resultado__votos">{option.votes}</span>
                    <span className="resultado__pct" style={{ display: "block" }}>
                      {formatPercentage(option.percentage)}
                    </span>
                  </span>
                  <span className="barra" aria-hidden="true">
                    <span style={{ width: `${Math.max(3, (option.votes / maxVotes) * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
