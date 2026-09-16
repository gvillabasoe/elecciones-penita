import Link from "next/link";
import { CandidacyForm } from "@/components/candidacy/CandidacyForm";
import { CandidacySummary } from "@/components/candidacy/CandidacySummary";
import { requireMember } from "@/lib/auth/current-member";
import { candidacyEditPermission, getOwnCandidacy } from "@/lib/election/candidacy";
import { toFormValues } from "@/lib/election/candidacy-form";
import { listCorrectionRequests, REVIEW_STATUS_LABELS } from "@/lib/election/corrections";
import { isMemberEligible } from "@/lib/election/eligibility";
import { findRound, getElection, serverNow } from "@/lib/election/state";
import { formatInstant } from "@/lib/time/format";

export const dynamic = "force-dynamic";

export default async function PresentarCandidaturaPage() {
  const member = await requireMember();

  const [election, now] = await Promise.all([getElection("LIVE"), serverNow()]);
  const firstRound = findRound(election.rounds, 1);

  if (!firstRound) {
    return <p className="aviso aviso--error">La elección no tiene primera vuelta configurada.</p>;
  }

  const [candidacy, eligible] = await Promise.all([
    getOwnCandidacy(election.id, member.id),
    isMemberEligible(election.id, member.id)
  ]);

  const corrections = candidacy ? await listCorrectionRequests(candidacy.id) : [];
  const openCorrections = corrections.filter((request) => request.status === "OPEN");

  const permission = candidacyEditPermission({
    election,
    firstRound,
    isOwner: true,
    isEligible: eligible,
    isDeleted: false,
    hasOpenCorrection: openCorrections.length > 0,
    now
  });

  const canPresentNew = candidacy === null && eligible && permission.canEdit;

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>{candidacy ? "Tu candidatura" : "Presentar candidatura"}</h1>
        {candidacy ? (
          <span className="chip chip--neutro">{REVIEW_STATUS_LABELS[candidacy.reviewStatus]}</span>
        ) : null}
      </div>

      {election.candidacyEditDeadline ? (
        <p className="texto-secundario" style={{ margin: 0 }}>
          Plazo para editar candidaturas: {formatInstant(election.candidacyEditDeadline)}
        </p>
      ) : null}

      {openCorrections.length > 0 ? (
        <section className="solido tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Corrección solicitada</h2>
          <p style={{ margin: 0 }}>
            La Junta Electoral ha pedido un cambio. El texto solo puedes modificarlo tú.
          </p>
          {openCorrections.map((request) => (
            <p key={request.id} className="aviso" style={{ marginBottom: 0 }}>
              {request.reason}
              <span className="texto-secundario" style={{ display: "block" }}>
                Solicitado por {request.requestedByName} · {formatInstant(request.createdAt)}
              </span>
            </p>
          ))}
        </section>
      ) : null}

      {candidacy ? (
        <>
          <CandidacySummary candidacy={candidacy} votable={eligible} />
          <Link href={`/candidaturas/${candidacy.id}`} className="btn btn--fantasma btn--bloque">
            Ver ficha pública
          </Link>
        </>
      ) : null}

      {permission.canEdit && (candidacy || canPresentNew) ? (
        <>
          <h2>{candidacy ? "Editar candidatura" : "Datos de la candidatura"}</h2>
          <CandidacyForm
            presidentName={member.displayName}
            initial={candidacy ? toFormValues(candidacy) : null}
          />
        </>
      ) : (
        <p className="aviso">
          {!eligible && !candidacy
            ? "Has sido excluido como opción votable: no puedes presentar una candidatura."
            : (permission.reason ?? "No puedes editar la candidatura en este momento.")}
        </p>
      )}
    </div>
  );
}
