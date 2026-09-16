"use client";

import { useMemo, useState } from "react";
import type { ExclusionReason } from "@prisma/client";
import { excludeMemberAction, reinstateMemberAction } from "@/app/(app)/junta-electoral/actions";
import { BoardFeedback, useBoardAction } from "@/components/board/BoardAction";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import {
  EXCLUSION_REASONS,
  EXCLUSION_REASON_DESCRIPTIONS,
  EXCLUSION_REASON_LABELS
} from "@/lib/election/exclusion-reasons";
import { matchesQuery } from "@/lib/validation/normalize";

export interface EligibilityRow {
  memberId: string;
  displayName: string;
  isEligible: boolean;
  reasons: ExclusionReason[];
  candidacyId: string | null;
  candidacyName: string | null;
  excludedByName: string | null;
}

interface Props {
  members: EligibilityRow[];
  /** Tras iniciar la votación la papeleta queda congelada. */
  locked: boolean;
}

/**
 * Miembros votables.
 *
 * Toda exclusión exige al menos un motivo: el botón de confirmación
 * permanece deshabilitado mientras no se elija ninguno.
 */
export function EligibilitySection({ members, locked }: Props) {
  const [query, setQuery] = useState("");
  const [excluding, setExcluding] = useState<EligibilityRow | null>(null);
  const [reinstating, setReinstating] = useState<EligibilityRow | null>(null);
  const [reasons, setReasons] = useState<ExclusionReason[]>([]);
  const { state, pending, run } = useBoardAction();

  const filtered = useMemo(
    () => members.filter((member) => matchesQuery(member.displayName, query)),
    [members, query]
  );

  const excluded = members.filter((member) => !member.isEligible);

  const toggleReason = (reason: ExclusionReason) => {
    setReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
    );
  };

  const openExclusion = (member: EligibilityRow) => {
    setReasons([]);
    setExcluding(member);
  };

  return (
    <div className="stack stack--s">
      <div className="fila">
        <span className="chip chip--activo">{members.length - excluded.length} votables</span>
        <span className="chip chip--excluido">{excluded.length} excluidos</span>
      </div>

      {locked ? (
        <p className="aviso">
          La votación ya ha comenzado: la papeleta está congelada y no se pueden cambiar las exclusiones.
        </p>
      ) : null}

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="buscador-miembros">
          Buscar miembro
        </label>
        <input
          id="buscador-miembros"
          className="entrada"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Nombre o apellido"
          value={query}
          onChange={(input) => setQuery(input.target.value)}
        />
      </div>

      <BoardFeedback state={state} />

      {filtered.length === 0 ? <p className="vacio">Ningún miembro coincide con la búsqueda.</p> : null}

      {filtered.map((member) => (
        <article key={member.memberId} className="tarjeta tarjeta--compacta stack stack--s">
          <div className="fila fila--separada">
            <span style={{ fontWeight: 600 }}>{member.displayName}</span>
            {member.isEligible ? (
              <span className="chip chip--activo">Votable</span>
            ) : (
              <span className="chip chip--excluido">No votable</span>
            )}
          </div>

          {member.candidacyName ? (
            <div className="texto-secundario">Candidatura: {member.candidacyName}</div>
          ) : null}

          {!member.isEligible && member.reasons.length > 0 ? (
            <div className="fila">
              {member.reasons.map((reason) => (
                <span key={reason} className="chip chip--excluido">
                  {EXCLUSION_REASON_LABELS[reason]}
                </span>
              ))}
            </div>
          ) : null}

          {!member.isEligible && member.excludedByName ? (
            <div className="texto-secundario">Excluido por {member.excludedByName}</div>
          ) : null}

          {!locked ? (
            <div className="fila">
              {member.isEligible ? (
                <button
                  type="button"
                  className="btn btn--peligro btn--pequeno"
                  disabled={pending}
                  onClick={() => openExclusion(member)}
                >
                  Excluir
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--fantasma btn--pequeno"
                  disabled={pending}
                  onClick={() => setReinstating(member)}
                >
                  Reincluir
                </button>
              )}
            </div>
          ) : null}
        </article>
      ))}

      {excluding ? (
        <ConfirmSheet
          titulo={`Excluir a ${excluding.displayName}`}
          confirmLabel="Confirmar exclusión"
          pendingLabel="Registrando exclusión…"
          pending={pending}
          confirmDisabled={reasons.length === 0}
          destructive
          onConfirm={() =>
            run(
              () => excludeMemberAction({ memberId: excluding.memberId, reasons }),
              () => setExcluding(null)
            )
          }
          onCancel={() => setExcluding(null)}
        >
          <p>Selecciona al menos un motivo. Pueden marcarse los dos a la vez.</p>

          <div className="stack stack--s">
            {EXCLUSION_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className="motivo"
                aria-pressed={reasons.includes(reason)}
                onClick={() => toggleReason(reason)}
              >
                <span style={{ display: "block", fontWeight: 600 }}>
                  {EXCLUSION_REASON_LABELS[reason]}
                </span>
                <span style={{ display: "block", fontSize: "0.8125rem", fontWeight: 400 }}>
                  {EXCLUSION_REASON_DESCRIPTIONS[reason]}
                </span>
              </button>
            ))}
          </div>

          <p className="texto-secundario">
            El miembro dejará de aparecer como persona votable y su candidatura pasará a “No votable”, pero
            podrá seguir iniciando sesión y votando.
          </p>
        </ConfirmSheet>
      ) : null}

      {reinstating ? (
        <ConfirmSheet
          titulo={`Reincluir a ${reinstating.displayName}`}
          confirmLabel="Confirmar reinclusión"
          pendingLabel="Reincluyendo…"
          pending={pending}
          onConfirm={() =>
            run(
              () => reinstateMemberAction({ memberId: reinstating.memberId }),
              () => setReinstating(null)
            )
          }
          onCancel={() => setReinstating(null)}
        >
          <p>
            Volverá a ser una persona votable, su candidatura activa volverá a ser votable y se eliminarán
            los motivos de exclusión.
          </p>
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
