"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProposalType } from "@prisma/client";
import {
  NOT_INCLUDED_LABEL,
  PROPOSAL_LABELS,
  PROPOSAL_ORDER
} from "@/lib/election/proposal-labels";

export interface ComparableSection {
  title: string | null;
  place: string;
  dates: string;
  description: string;
}

export interface ComparableCandidacy {
  candidacyId: string;
  name: string;
  slogan: string;
  presidentName: string;
  color: string;
  sections: Partial<Record<ProposalType, ComparableSection>>;
  promises: string[];
}

interface Props {
  candidacies: ComparableCandidacy[];
  initialA: string | null;
  initialB: string | null;
}

/**
 * Comparador neutral de candidaturas.
 *
 * Muestra el contenido original de cada candidatura en un orden fijo de
 * categorias. No puntua, no recomienda, no ordena por calidad ni por
 * popularidad y no destaca ninguna candidatura. Cuando una seccion opcional no
 * existe, la categoria sigue apareciendo con el texto correspondiente.
 *
 * En movil la comparacion es vertical: primero una candidatura y despues la
 * otra dentro de cada categoria, sin tablas anchas.
 */
export function CandidacyComparator({ candidacies, initialA, initialB }: Props) {
  const router = useRouter();
  const [a, setA] = useState(initialA ?? candidacies[0]?.candidacyId ?? "");
  const [b, setB] = useState(initialB ?? candidacies[1]?.candidacyId ?? "");

  const left = candidacies.find((candidacy) => candidacy.candidacyId === a) ?? null;
  const right = candidacies.find((candidacy) => candidacy.candidacyId === b) ?? null;

  const sync = (nextA: string, nextB: string) => {
    const params = new URLSearchParams();
    if (nextA) params.set("a", nextA);
    if (nextB) params.set("b", nextB);
    router.replace(`/eleccion/comparar?${params.toString()}`, { scroll: false });
  };

  const selector = (
    id: string,
    label: string,
    value: string,
    onChange: (next: string) => void
  ) => (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="selector"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Sin seleccionar</option>
        {candidacies.map((candidacy) => (
          <option key={candidacy.candidacyId} value={candidacy.candidacyId}>
            {candidacy.name} · {candidacy.presidentName}
          </option>
        ))}
      </select>
    </div>
  );

  const side = (candidacy: ComparableCandidacy | null, content: React.ReactNode) => {
    if (!candidacy) return null;
    return (
      <div className="comparador__lado" style={{ borderLeftColor: candidacy.color }}>
        <h4>{candidacy.name}</h4>
        {content}
      </div>
    );
  };

  const textRow = (label: string, pick: (candidacy: ComparableCandidacy) => string) => (
    <details className="acordeon" key={label}>
      <summary>
        <span>{label}</span>
      </summary>
      <div className="comparador__categoria">
        {side(left, <p style={{ margin: 0 }}>{left ? pick(left) : ""}</p>)}
        {side(right, <p style={{ margin: 0 }}>{right ? pick(right) : ""}</p>)}
      </div>
    </details>
  );

  const sectionContent = (candidacy: ComparableCandidacy, type: ProposalType) => {
    const section = candidacy.sections[type];
    if (!section) return <p className="comparador__vacio">{NOT_INCLUDED_LABEL}</p>;

    return (
      <div className="stack stack--s">
        {section.title ? <div style={{ fontWeight: 600 }}>{section.title}</div> : null}
        <div className="texto-secundario">Lugar: {section.place}</div>
        <div className="texto-secundario texto-cifra">{section.dates}</div>
        <p style={{ margin: 0 }}>{section.description}</p>
      </div>
    );
  };

  return (
    <div className="stack">
      <section className="solido tarjeta stack stack--s">
        <p style={{ margin: 0 }}>
          Compara dos candidaturas con el mismo orden de categorías. El comparador no puntúa ni
          recomienda: muestra el contenido tal y como lo escribió cada candidato.
        </p>
        {selector("comparar-a", "Primera candidatura", a, (next) => {
          setA(next);
          sync(next, b);
        })}
        {selector("comparar-b", "Segunda candidatura", b, (next) => {
          setB(next);
          sync(a, next);
        })}

        <div className="fila">
          {left ? (
            <Link href={`/candidaturas/${left.candidacyId}`} className="btn btn--fantasma btn--pequeno">
              Detalle de {left.name}
            </Link>
          ) : null}
          {right ? (
            <Link href={`/candidaturas/${right.candidacyId}`} className="btn btn--fantasma btn--pequeno">
              Detalle de {right.name}
            </Link>
          ) : null}
          <Link href="/eleccion" className="btn btn--fantasma btn--pequeno">
            Volver a Elección
          </Link>
        </div>
      </section>

      {!left && !right ? (
        <p className="vacio">Selecciona dos candidaturas para compararlas.</p>
      ) : (
        <div className="stack stack--s">
          {textRow("Nombre", (candidacy) => candidacy.name)}
          {textRow("Eslogan", (candidacy) => candidacy.slogan)}
          {textRow("Presidente", (candidacy) => candidacy.presidentName)}

          {PROPOSAL_ORDER.map((type) => (
            <details className="acordeon" key={type}>
              <summary>
                <span>{PROPOSAL_LABELS[type]}</span>
              </summary>
              <div className="comparador__categoria">
                {side(left, left ? sectionContent(left, type) : null)}
                {side(right, right ? sectionContent(right, type) : null)}
              </div>
            </details>
          ))}

          <details className="acordeon">
            <summary>
              <span>Otras premisas</span>
            </summary>
            <div className="comparador__categoria">
              {side(
                left,
                left && left.promises.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: "1.1rem" }}>
                    {left.promises.map((promise, index) => (
                      <li key={index}>{promise}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="comparador__vacio">{NOT_INCLUDED_LABEL}</p>
                )
              )}
              {side(
                right,
                right && right.promises.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: "1.1rem" }}>
                    {right.promises.map((promise, index) => (
                      <li key={index}>{promise}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="comparador__vacio">{NOT_INCLUDED_LABEL}</p>
                )
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
