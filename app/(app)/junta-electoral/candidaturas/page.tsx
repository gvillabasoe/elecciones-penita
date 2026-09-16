import { CandidacyReviewSection, type BoardCandidacyRow } from "@/components/board/CandidacyReviewSection";
import { DeadlineSection } from "@/components/board/DeadlineSection";
import { requireBoardMember } from "@/lib/auth/current-member";
import { listCandidaciesForBoard } from "@/lib/election/candidacy";
import { listEligibility } from "@/lib/election/eligibility";
import { findRound, getElection } from "@/lib/election/state";
import { toDateTimeLocalValue } from "@/lib/time/format";

export const dynamic = "force-dynamic";

export default async function JuntaCandidaturasPage() {
  await requireBoardMember();

  const election = await getElection("LIVE");
  const firstRound = findRound(election.rounds, 1);
  const votingStarted = firstRound ? firstRound.status !== "READY_TO_START" : false;

  const [candidacies, eligibility] = await Promise.all([
    listCandidaciesForBoard(election.id),
    listEligibility(election.id)
  ]);

  const excludedIds = new Set(
    eligibility.filter((row) => !row.isEligible).map((row) => row.memberId)
  );

  const rows: BoardCandidacyRow[] = candidacies.map((candidacy) => ({
    candidacyId: candidacy.id,
    name: candidacy.name,
    slogan: candidacy.slogan,
    presidentName: candidacy.president.displayName,
    color: candidacy.pastelColor,
    isDeleted: candidacy.isDeleted,
    isVotable: !candidacy.isDeleted && !excludedIds.has(candidacy.presidentId),
    reviewStatus: candidacy.reviewStatus,
    proposals: candidacy.proposals.length,
    promises: candidacy.promises.length,
    openCorrections: candidacy.correctionRequests.map((request) => ({
      id: request.id,
      reason: request.reason,
      createdAt: request.createdAt.toISOString()
    }))
  }));

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Candidaturas</h1>
        <span className="chip chip--neutro">{rows.length} en total</span>
      </div>

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Plazo de presentación y edición</h2>
        <DeadlineSection current={toDateTimeLocalValue(election.candidacyEditDeadline)} />
      </section>

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Revisión</h2>
        <p className="texto-secundario" style={{ margin: 0 }}>
          La Junta Electoral no modifica el contenido redactado por un candidato: solicita
          correcciones motivadas, valida, marca como no válida o elimina.
        </p>
        <CandidacyReviewSection candidacies={rows} mode="LIVE" editable={!votingStarted} />
      </section>
    </div>
  );
}
