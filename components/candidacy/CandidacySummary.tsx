import type { ProposalType } from "@prisma/client";
import {
  NOT_INCLUDED_LABEL,
  PROPOSAL_LABELS,
  PROPOSAL_ORDER,
  RANGE_PROPOSAL_TYPES
} from "@/lib/election/proposal-labels";
import type { CandidacyWithDetails } from "@/lib/election/candidacy";
import { REVIEW_STATUS_LABELS } from "@/lib/election/corrections";
import { formatCalendarDate, formatCalendarRange } from "@/lib/time/format";

interface Props {
  candidacy: CandidacyWithDetails;
  votable?: boolean;
  showReviewStatus?: boolean;
}

function proposalDates(type: ProposalType, startDate: Date | null, endDate: Date | null): string {
  if (RANGE_PROPOSAL_TYPES.includes(type)) return formatCalendarRange(startDate, endDate);
  return formatCalendarDate(startDate);
}

/**
 * Ficha de candidatura en modo lectura.
 *
 * Las categorías se muestran SIEMPRE en el mismo orden fijo, el mismo que usa
 * el comparador, y las que no existen se declaran expresamente en lugar de
 * desaparecer. Las fechas tentativas son fechas de calendario: no se
 * desplazan de día.
 */
export function CandidacySummary({ candidacy, votable = true, showReviewStatus = false }: Props) {
  const byType = new Map(candidacy.proposals.map((proposal) => [proposal.type, proposal]));
  const present = PROPOSAL_ORDER.filter((type) => byType.has(type));
  const missing = PROPOSAL_ORDER.filter((type) => !byType.has(type));

  return (
    <div className="stack">
      <section
        className="cristal tarjeta stack stack--s"
        style={{ borderLeft: `4px solid ${candidacy.pastelColor}` }}
        aria-label="Datos de la candidatura"
      >
        <div className="fila fila--separada">
          <h2 style={{ margin: 0 }}>{candidacy.name}</h2>
          {candidacy.isDeleted ? (
            <span className="chip chip--excluido">Eliminada</span>
          ) : votable ? (
            <span className="chip chip--activo">Votable</span>
          ) : (
            <span className="chip chip--excluido">No votable</span>
          )}
        </div>
        <p style={{ margin: 0, fontStyle: "italic" }}>{candidacy.slogan}</p>
        <p className="texto-secundario" style={{ margin: 0 }}>
          Presidente: {candidacy.president.displayName}
        </p>
        {showReviewStatus ? (
          <span className="chip chip--neutro">{REVIEW_STATUS_LABELS[candidacy.reviewStatus]}</span>
        ) : null}
        <p className="texto-secundario" style={{ margin: 0 }}>
          Esta candidatura se integra en la opción de voto de su presidente: no es una opción
          independiente.
        </p>
      </section>

      <section className="stack stack--s" aria-label="Propuestas">
        <h3 style={{ margin: 0 }}>Propuestas</h3>
        {present.length === 0 ? (
          <p className="vacio">Esta candidatura no tiene propuestas registradas.</p>
        ) : (
          present.map((type) => {
            const proposal = byType.get(type);
            if (!proposal) return null;
            return (
              <article key={proposal.id} className="cristal tarjeta tarjeta--compacta stack stack--s">
                <div className="fila fila--separada">
                  <span style={{ fontWeight: 650 }}>{PROPOSAL_LABELS[type]}</span>
                  <span className="chip chip--neutro texto-cifra">
                    {proposalDates(type, proposal.startDate, proposal.endDate)}
                  </span>
                </div>
                {proposal.title ? <div style={{ fontWeight: 560 }}>{proposal.title}</div> : null}
                <div className="texto-secundario">Lugar: {proposal.place}</div>
                <p style={{ margin: 0 }}>{proposal.description}</p>
              </article>
            );
          })
        )}
      </section>

      {missing.length > 0 ? (
        <section className="cristal tarjeta tarjeta--compacta stack stack--s" aria-label="Categorías no incluidas">
          <h3 style={{ margin: 0 }}>Categorías no incluidas</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {missing.map((type) => (
              <li key={type} className="texto-secundario">
                {PROPOSAL_LABELS[type]}: {NOT_INCLUDED_LABEL}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="cristal tarjeta stack stack--s" aria-label="Otras premisas">
        <h3 style={{ margin: 0 }}>Otras premisas</h3>
        {candidacy.promises.length > 0 ? (
          <ol className="stack stack--s" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {candidacy.promises.map((promise) => (
              <li key={promise.id}>{promise.text}</li>
            ))}
          </ol>
        ) : (
          <p className="comparador__vacio">{NOT_INCLUDED_LABEL}</p>
        )}
      </section>
    </div>
  );
}
