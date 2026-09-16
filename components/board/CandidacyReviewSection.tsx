"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CandidacyReviewStatus } from "@prisma/client";
import {
  deleteCandidacyAction,
  requestCorrectionAction,
  setReviewStatusAction
} from "@/app/(app)/junta-electoral/actions";
import { BoardFeedback, useBoardAction } from "@/components/board/BoardAction";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { REVIEW_STATUS_LABELS } from "@/lib/election/review-labels";
import type { ElectionMode } from "@/lib/election/mode";
import { matchesQuery } from "@/lib/validation/normalize";

export interface BoardCandidacyRow {
  candidacyId: string;
  name: string;
  slogan: string;
  presidentName: string;
  color: string;
  isDeleted: boolean;
  isVotable: boolean;
  reviewStatus: CandidacyReviewStatus;
  proposals: number;
  promises: number;
  openCorrections: { id: string; reason: string; createdAt: string }[];
}

interface Props {
  candidacies: BoardCandidacyRow[];
  mode: ElectionMode;
  /** Antes de iniciar la votacion la Junta puede revisar y eliminar. */
  editable: boolean;
}

const STATUS_CHIP: Record<CandidacyReviewStatus, string> = {
  PENDING_REVIEW: "chip chip--neutro",
  VALID: "chip chip--activo",
  CORRECTION_REQUESTED: "chip chip--excluido",
  INVALID: "chip chip--excluido"
};

/**
 * Revision de candidaturas.
 *
 * La Junta Electoral ya no edita el contenido redactado por un candidato:
 * solicita correcciones motivadas, valida, marca como no valida o elimina
 * cuando las reglas lo permiten. El cambio material lo hace el candidato.
 */
export function CandidacyReviewSection({ candidacies, mode, editable }: Props) {
  const { state, pending, run } = useBoardAction();
  const [query, setQuery] = useState("");
  const [correcting, setCorrecting] = useState<BoardCandidacyRow | null>(null);
  const [reason, setReason] = useState("");
  const [invalidating, setInvalidating] = useState<BoardCandidacyRow | null>(null);
  const [deleting, setDeleting] = useState<BoardCandidacyRow | null>(null);

  const filtered = useMemo(
    () =>
      candidacies.filter(
        (candidacy) =>
          matchesQuery(candidacy.name, query) || matchesQuery(candidacy.presidentName, query)
      ),
    [candidacies, query]
  );

  const pendingCorrections = candidacies.filter((row) => row.openCorrections.length > 0).length;

  return (
    <div className="stack stack--s">
      <div className="fila">
        <span className="chip chip--activo">
          {candidacies.filter((row) => !row.isDeleted).length} activas
        </span>
        {pendingCorrections > 0 ? (
          <span className="chip chip--excluido">{pendingCorrections} pendientes de corrección</span>
        ) : null}
      </div>

      {!editable ? (
        <p className="aviso">
          La votación ya ha comenzado: las candidaturas están congeladas y no admiten cambios ni
          solicitudes de corrección.
        </p>
      ) : null}

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="buscador-candidaturas">
          Buscar candidatura
        </label>
        <input
          id="buscador-candidaturas"
          className="entrada"
          type="search"
          autoComplete="off"
          placeholder="Nombre de la candidatura o del presidente"
          value={query}
          onChange={(input) => setQuery(input.target.value)}
        />
      </div>

      <BoardFeedback state={state} />

      {filtered.length === 0 ? (
        <p className="vacio">Ninguna candidatura coincide con la búsqueda.</p>
      ) : null}

      {filtered.map((candidacy) => (
        <article
          key={candidacy.candidacyId}
          className="solido tarjeta tarjeta--compacta stack stack--s"
          style={{ borderLeftWidth: "4px", borderLeftColor: candidacy.color }}
        >
          <div className="fila fila--separada">
            <span style={{ fontWeight: 620 }}>{candidacy.name}</span>
            {candidacy.isDeleted ? (
              <span className="chip chip--excluido">Eliminada</span>
            ) : (
              <span className={STATUS_CHIP[candidacy.reviewStatus]}>
                {REVIEW_STATUS_LABELS[candidacy.reviewStatus]}
              </span>
            )}
          </div>

          <div className="texto-secundario">{candidacy.slogan}</div>
          <div className="texto-secundario">Presidente: {candidacy.presidentName}</div>
          <div className="texto-secundario texto-cifra">
            {candidacy.proposals} propuestas · {candidacy.promises} premisas
          </div>
          {!candidacy.isDeleted && !candidacy.isVotable ? (
            <div className="texto-secundario">
              El presidente está excluido: la candidatura no será votable.
            </div>
          ) : null}

          {candidacy.openCorrections.length > 0 ? (
            <div className="stack stack--s">
              <span style={{ fontWeight: 600 }}>Correcciones solicitadas</span>
              {candidacy.openCorrections.map((correction) => (
                <p key={correction.id} className="aviso" style={{ marginBottom: 0 }}>
                  {correction.reason}
                  <span className="texto-secundario" style={{ display: "block" }}>
                    Acción requerida: el candidato debe modificar su candidatura.
                  </span>
                </p>
              ))}
            </div>
          ) : null}

          <Link href={`/candidaturas/${candidacy.candidacyId}`} className="btn btn--fantasma btn--pequeno">
            Ver detalle
          </Link>

          {editable && !candidacy.isDeleted ? (
            <div className="fila">
              <button
                type="button"
                className="btn btn--fantasma btn--pequeno"
                disabled={pending}
                onClick={() => {
                  setReason("");
                  setCorrecting(candidacy);
                }}
              >
                Solicitar corrección
              </button>
              <button
                type="button"
                className="btn btn--acento btn--pequeno"
                disabled={pending || candidacy.reviewStatus === "VALID"}
                onClick={() =>
                  run(() =>
                    setReviewStatusAction({
                      candidacyId: candidacy.candidacyId,
                      status: "VALID",
                      mode
                    })
                  )
                }
              >
                Marcar válida
              </button>
              <button
                type="button"
                className="btn btn--peligro btn--pequeno"
                disabled={pending || candidacy.reviewStatus === "INVALID"}
                onClick={() => setInvalidating(candidacy)}
              >
                Marcar no válida
              </button>
              <button
                type="button"
                className="btn btn--peligro btn--pequeno"
                disabled={pending}
                onClick={() => setDeleting(candidacy)}
              >
                Eliminar
              </button>
            </div>
          ) : null}
        </article>
      ))}

      {correcting ? (
        <ConfirmSheet
          titulo={`Solicitar corrección · ${correcting.name}`}
          confirmLabel="Enviar solicitud"
          pendingLabel="Enviando…"
          pending={pending}
          confirmDisabled={reason.trim().length < 10}
          onConfirm={() =>
            run(
              () =>
                requestCorrectionAction({
                  candidacyId: correcting.candidacyId,
                  reason: reason.trim(),
                  mode
                }),
              () => setCorrecting(null)
            )
          }
          onCancel={() => setCorrecting(null)}
        >
          <p>
            La Junta Electoral no modifica el contenido: el candidato realizará el cambio. Explica el
            motivo con claridad.
          </p>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="motivo-correccion">
              Motivo de la corrección
            </label>
            <textarea
              id="motivo-correccion"
              className="area"
              maxLength={600}
              value={reason}
              onChange={(input) => setReason(input.target.value)}
            />
            <span className="campo__ayuda">Mínimo 10 caracteres.</span>
          </div>
        </ConfirmSheet>
      ) : null}

      {invalidating ? (
        <ConfirmSheet
          titulo={`Marcar no válida · ${invalidating.name}`}
          confirmLabel="Marcar no válida"
          pendingLabel="Guardando…"
          pending={pending}
          destructive
          onConfirm={() =>
            run(
              () =>
                setReviewStatusAction({
                  candidacyId: invalidating.candidacyId,
                  status: "INVALID",
                  mode
                }),
              () => setInvalidating(null)
            )
          }
          onCancel={() => setInvalidating(null)}
        >
          <p>
            La candidatura no se integrará en la papeleta: su presidente aparecerá como miembro sin
            candidatura formal. El contenido no se modifica y queda registrado en la auditoría.
          </p>
        </ConfirmSheet>
      ) : null}

      {deleting ? (
        <ConfirmSheet
          titulo={`Eliminar “${deleting.name}”`}
          confirmLabel="Eliminar candidatura"
          pendingLabel="Eliminando…"
          pending={pending}
          destructive
          onConfirm={() =>
            run(
              () => deleteCandidacyAction({ candidacyId: deleting.candidacyId, mode }),
              () => setDeleting(null)
            )
          }
          onCancel={() => setDeleting(null)}
        >
          <p>
            Dejará de aparecer en los listados y en la papeleta. Su presidente seguirá siendo un miembro
            votable si no está excluido.
          </p>
          <p className="texto-secundario">
            Solo puede eliminarse antes de iniciar la votación. Queda registrado en la auditoría.
          </p>
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
