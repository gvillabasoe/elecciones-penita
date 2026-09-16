import { VotingSection, type VotingRoundView } from "@/components/board/VotingSection";
import { requireBoardMember } from "@/lib/auth/current-member";
import { participationSummary } from "@/lib/election/participation";
import { ballotPreview } from "@/lib/election/rounds";
import {
  effectiveStatus,
  getElection,
  hasVotingFinished,
  roundLabel,
  serverNow,
  settleExpiredRounds
} from "@/lib/election/state";
import { roundIntegrity } from "@/lib/results/integrity";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function JuntaVotacionPage() {
  await requireBoardMember();
  await settleExpiredRounds("LIVE");

  const [election, now] = await Promise.all([getElection("LIVE"), serverNow()]);
  const preview = await ballotPreview(election.id);

  const views = await Promise.all(
    election.rounds.map(async (round) => {
      const [frozenOptions, integrity, participation] = await Promise.all([
        prisma.roundBallotOption.count({ where: { roundId: round.id } }),
        roundIntegrity(round, now),
        round.status === "READY_TO_START" ? Promise.resolve(null) : participationSummary(round, now)
      ]);

      const view: VotingRoundView = {
        roundId: round.id,
        roundNumber: round.roundNumber,
        label: roundLabel(round.roundNumber),
        mode: round.mode,
        status: effectiveStatus(round, now),
        revealStage: round.resultsRevealStage,
        votingDurationSeconds: round.votingDurationSeconds,
        votingClosesAt: round.votingClosesAt ? round.votingClosesAt.toISOString() : null,
        resultsCountdownDurationSeconds: round.resultsCountdownDurationSeconds,
        resultsRevealAt: round.resultsRevealAt ? round.resultsRevealAt.toISOString() : null,
        frozenOptions,
        preview
      };

      const integrityNote =
        hasVotingFinished(round, now) && integrity.countsMatch
          ? `Recuento completado. Se han registrado ${integrity.participationCount} participaciones y ${integrity.ballotCount} papeletas válidas.`
          : integrity.blockedReason;

      return { round, view, integrityNote, participation };
    })
  );

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Votación</h1>
        <span className="chip chip--activo">Elección real</span>
      </div>

      <p className="aviso">
        En la elección real no existe cierre anticipado: la ronda termina exclusivamente al alcanzar su
        fecha y hora de cierre, calculada por PostgreSQL.
      </p>

      {views.map((item) => (
        <section key={item.round.id} className="solido tarjeta">
          <VotingSection
            round={item.view}
            serverNowIso={now.toISOString()}
            participation={item.participation}
            integrityNote={item.integrityNote}
          />
        </section>
      ))}
    </div>
  );
}
