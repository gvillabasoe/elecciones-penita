import { podiumStyleFor, positionLabel, type RankGroup } from "@/lib/results/ranking";

interface Props {
  groups: RankGroup[];
  totalValidVotes: number;
  tie: boolean;
}

function formatPercentage(value: number): string {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/**
 * Podio dinamico.
 *
 * Solo existen las posiciones que realmente existen: no se dibujan tarjetas
 * vacias ni huecos de relleno. Si varias opciones comparten posicion, todas
 * reciben el mismo metal y aparecen al mismo nivel, sin declarar un ganador
 * unico. La posicion nunca se comunica solo con el color: siempre hay numero,
 * etiqueta y medalla.
 *
 * Version estatica: las animaciones son una mejora, nunca un requisito.
 */
export function Podium({ groups, totalValidVotes, tie }: Props) {
  const ordered = [...groups].sort((a, b) => a.position - b.position);

  return (
    <div className="podio">
      {tie ? (
        <p className="empate-aviso" role="status">
          Empate en primera posición
        </p>
      ) : null}

      {ordered.map((group) => {
        const style = podiumStyleFor(group.position);
        const delay = (3 - group.position) * 320 + 200;

        return (
          <div key={group.position} className="stack stack--s">
            {group.options.length > 1 ? (
              <p className="texto-secundario" style={{ margin: 0 }}>
                {positionLabel(group.position)} puesto compartido por {group.options.length} opciones
              </p>
            ) : null}

            {group.options.map((option) => (
              <article
                key={option.optionId}
                className="podio__tarjeta"
                style={
                  {
                    "--retardo": `${delay}ms`,
                    "--metal": style?.hex ?? "var(--principal-40)"
                  } as React.CSSProperties
                }
              >
                <span className="podio__medalla texto-cifra" aria-hidden="true">
                  {positionLabel(group.position)}
                </span>

                <div>
                  <div className="podio__nombre">{option.memberName}</div>
                  <div className="podio__metal">
                    {style
                      ? `${positionLabel(group.position)} puesto · ${style.label}`
                      : positionLabel(group.position)}
                    {group.options.length > 1 ? " · Empate" : ""}
                  </div>
                  <div className="texto-secundario">
                    {option.hasFormalCandidacy ? "Con candidatura" : "Sin candidatura formal"}
                    {option.candidacyName ? ` · ${option.candidacyName}` : ""}
                  </div>
                  {option.slogan ? (
                    <div className="texto-secundario" style={{ fontStyle: "italic" }}>
                      {option.slogan}
                    </div>
                  ) : null}
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      height: "6px",
                      borderRadius: "999px",
                      marginTop: "0.5rem",
                      background: option.color
                    }}
                  />
                </div>

                <div className="resultado__cifras">
                  <div className="resultado__votos texto-cifra" style={{ fontSize: "1.375rem" }}>
                    {option.votes}
                  </div>
                  <div className="resultado__pct texto-cifra">{formatPercentage(option.percentage)}</div>
                </div>
              </article>
            ))}
          </div>
        );
      })}

      <p className="visualmente-oculto">
        Resultado del podio sobre {totalValidVotes} votos válidos.
      </p>
    </div>
  );
}
