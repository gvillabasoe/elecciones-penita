import Link from "next/link";
import { RevealStepper } from "@/components/board/RevealStepper";
import { SimulationSection } from "@/components/board/SimulationSection";
import { VotingSection, type VotingRoundView } from "@/components/board/VotingSection";
import { ModeBanner } from "@/components/election/ModeBanner";
import { ResultsBoard } from "@/components/results/ResultsBoard";
import { requireBoardMember } from "@/lib/auth/current-member";
import { participationSummary } from "@/lib/election/participation";
import { ballotPreview, resetPreview, runoffAvailability } from "@/lib/election/rounds";
import {
  effectiveStatus,
  findRound,
  getElection,
  MODE_LABELS,
  roundLabel,
  serverNow,
  settleExpiredRounds
} from "@/lib/election/state";
import { roundIntegrity } from "@/lib/results/integrity";
import { publishedResults } from "@/lib/results/published";

export const dynamic = "force-dynamic";

/**
 * Pruebas.
 *
 * Contiene exclusivamente la elección en modo TEST: simulaciones, ensayos,
 * reinicios y el ensayo de resultados. Ninguna herramienta de esta página
 * puede tocar la elección real, ni por interfaz ni por Server Action.
 */
export default async function JuntaPruebasPage() {
  await requireBoardMember();
  await settleExpiredRounds("TEST");

  const [election, now] = await Promise.all([getElection("TEST"), serverNow()]);
  const preview = await ballotPreview(election.id);
  const runoffRound = findRound(election.rounds, 2);

  const views = await Promise.all(
    election.rounds.map(async (round) => {
      const [counts, integrity, results, participation] = await Promise.all([
        resetPreview(round.id),
        roundIntegrity(round, now),
        publishedResults(round),
        round.status === "READY_TO_START" ? Promise.resolve(null) : participationSummary(round, now)
      ]);

      const runoff =
        round.roundNumber === 1
          ? await runoffAvailability({
              electionId: election.id,
              sourceRound: round,
              runoffExists: runoffRound !== null,
              now
            })
          : null;

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
        frozenOptions: counts.options,
        preview
      };

      return { round, counts, integrity, results, runoff, view, participation };
    })
  );

  return (
    <div className="stack">
      <ModeBanner mode="TEST" />

      <div className="seccion__titulo">
        <h1>Pruebas</h1>
        <span className="chip chip--excluido">{MODE_LABELS[election.mode]}</span>
      </div>

      <p className="texto-secundario" style={{ margin: 0 }}>
        Elección de ensayo independiente. Sus votos no cuentan, su participación no bloquea la
        elección real y su reinicio no afecta a ningún dato real.
      </p>

      <Link href="/junta-electoral/pruebas/resultados" className="btn btn--principal btn--bloque">
        Ensayo de resultados con datos ficticios
      </Link>

      {views.map((item) => (
        <section key={item.round.id} className="solido tarjeta stack">
          <h2 style={{ margin: 0 }}>Simulación · {roundLabel(item.round.roundNumber)}</h2>

          <VotingSection
            round={item.view}
            serverNowIso={now.toISOString()}
            participation={item.participation}
            integrityNote={item.integrity.blockedReason}
          />

          <RevealStepper
            roundId={item.round.id}
            roundLabel={roundLabel(item.round.roundNumber)}
            mode="TEST"
            stage={item.round.resultsRevealStage}
            integrity={item.integrity}
            runoff={item.runoff}
            runoffExists={runoffRound !== null}
          />

          {item.results.stage !== "HIDDEN" ? (
            <ResultsBoard
              results={item.results}
              roundLabel={`Simulación · ${roundLabel(item.round.roundNumber)}`}
            />
          ) : null}

          <SimulationSection
            roundId={item.round.id}
            label={roundLabel(item.round.roundNumber)}
            ballots={item.counts.ballots}
            participations={item.counts.participations}
            options={item.counts.options}
          />
        </section>
      ))}
    </div>
  );
}
