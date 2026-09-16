import { EligibilitySection, type EligibilityRow } from "@/components/board/EligibilitySection";
import { requireBoardMember } from "@/lib/auth/current-member";
import { listEligibility } from "@/lib/election/eligibility";
import { findRound, getElection } from "@/lib/election/state";

export const dynamic = "force-dynamic";

export default async function JuntaCensoPage() {
  await requireBoardMember();

  const election = await getElection("LIVE");
  const firstRound = findRound(election.rounds, 1);
  const votingStarted = firstRound ? firstRound.status !== "READY_TO_START" : false;

  const eligibility = await listEligibility(election.id);
  const rows: EligibilityRow[] = eligibility.map((row) => ({
    memberId: row.memberId,
    displayName: row.displayName,
    isEligible: row.isEligible,
    reasons: row.reasons,
    candidacyId: row.candidacyId,
    candidacyName: row.candidacyName,
    excludedByName: row.excludedByName
  }));

  const excluded = rows.filter((row) => !row.isEligible).length;

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Censo</h1>
        <span className="chip chip--activo">{rows.length - excluded} votables</span>
      </div>

      <p className="texto-secundario" style={{ margin: 0 }}>
        La exclusión afecta solo a la posibilidad de ser elegido. Un miembro excluido conserva su
        derecho a emitir voto. Esta pantalla no muestra quién ha votado.
      </p>

      <section className="solido tarjeta">
        <EligibilitySection members={rows} locked={votingStarted} />
      </section>
    </div>
  );
}
