"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { castVoteAction } from "@/app/(app)/eleccion/actions";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { matchesQuery } from "@/lib/validation/normalize";
import type { BallotOptionView } from "@/lib/voting/vote";

interface Props {
  roundId: string;
  options: BallotOptionView[];
}

export const BALLOT_INTRO =
  "Selecciona a un miembro. Si ha presentado candidatura, podrás consultar también su candidatura y sus propuestas.";

/**
 * Papeleta.
 *
 * Un unico grupo de radio accesible con EXACTAMENTE UNA OPCION POR MIEMBRO.
 * La candidatura, cuando existe, enriquece la opcion del miembro: nunca es una
 * opcion independiente ni divide sus votos.
 */
export function BallotForm({ roundId, options }: Props) {
  const [optionId, setOptionId] = useState("");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return options;
    return options.filter(
      (option) =>
        matchesQuery(option.memberName, query) ||
        (option.candidacyName ? matchesQuery(option.candidacyName, query) : false)
    );
  }, [options, query]);

  const selected = options.find((option) => option.optionId === optionId) ?? null;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await castVoteAction({ roundId, optionId });
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
    });
  };

  return (
    <div className="stack">
      <p>{BALLOT_INTRO}</p>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="buscador-papeleta">
          Buscar en la papeleta
        </label>
        <input
          id="buscador-papeleta"
          className="entrada"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Nombre, apellido o candidatura"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <fieldset className="papeleta">
        <legend className="visualmente-oculto">Miembros votables</legend>

        {filtered.map((option) => (
          <div key={option.optionId} className="stack stack--s" style={{ gap: "0.25rem" }}>
            <label className="opcion">
              <input
                type="radio"
                name="opcion"
                value={option.optionId}
                checked={optionId === option.optionId}
                onChange={() => setOptionId(option.optionId)}
              />
              <span className="punto" aria-hidden="true" style={{ background: option.color }} />
              <span className="opcion__cuerpo">
                <span className="opcion__nombre">{option.memberName}</span>
                <span className="opcion__insignia">
                  {option.hasFormalCandidacy ? "Con candidatura" : "Sin candidatura formal"}
                </span>
                {option.candidacyName ? (
                  <span className="opcion__meta">
                    {option.candidacyName}
                    {option.slogan ? ` · ${option.slogan}` : ""}
                  </span>
                ) : null}
              </span>
            </label>

            {option.candidacyId ? (
              <Link className="opcion__enlace" href={`/candidaturas/${option.candidacyId}`}>
                Ver candidatura y propuestas
              </Link>
            ) : null}
          </div>
        ))}

        {filtered.length === 0 ? (
          <p className="vacio">Ningún miembro coincide con la búsqueda.</p>
        ) : null}
      </fieldset>

      {error ? (
        <p className="aviso aviso--error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn--principal btn--bloque"
        disabled={!selected || pending}
        onClick={() => setConfirming(true)}
      >
        Continuar
      </button>

      {confirming && selected ? (
        <ConfirmSheet
          titulo="Confirmar tu voto"
          confirmLabel="Confirmar voto"
          pendingLabel="Registrando voto…"
          pending={pending}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        >
          <div className="fila" style={{ gap: "0.6rem" }}>
            <span className="punto" aria-hidden="true" style={{ background: selected.color }} />
            <div>
              <div style={{ fontWeight: 650 }}>{selected.memberName}</div>
              {selected.candidacyName ? (
                <div className="texto-secundario">{selected.candidacyName}</div>
              ) : (
                <div className="texto-secundario">Sin candidatura formal</div>
              )}
              {selected.slogan ? (
                <div className="texto-secundario" style={{ fontStyle: "italic" }}>
                  {selected.slogan}
                </div>
              ) : null}
            </div>
          </div>
          <p>Cada miembro solo puede emitir un voto por ronda.</p>
          <p>Una vez confirmado, el voto es irreversible y no podrás cambiarlo.</p>
          <p className="texto-secundario">
            Tu papeleta se guarda por separado y no contiene ninguna referencia a ti.{" "}
            <Link href="/como-funciona">Cómo funciona</Link>
          </p>
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
