import { RevealStepper } from "@/components/board/RevealStepper";
import { ResultsBoard } from "@/components/results/ResultsBoard";
import { requireBoardMember } from "@/lib/auth/current-member";
import { findRound, getElection, roundLabel, serverNow, settleExpiredRounds } from "@/lib/election/state";
import { roundIntegrity } from "@/lib/results/integrity";
import { publishedResults } from "@/lib/results/published";
import { runoffAvailability } from "@/lib/election/rounds";

export const dynamic = "force-dynamic";

/**
 * Resultados (Junta Electoral).
 *
 * La Junta ve exactamente lo mismo que el resto de miembros: los resultados
 * publicados. Antes de publicar una fase solo dispone de verificaciones de
 * integridad, nunca de votos, ranking, empates ni ganadores.
 */
export default async function JuntaResultadosPage() {
  await requireBoardMember();
  await settleExpiredRounds("LIVE");

  const [election, now] = await Promise.all([getElection("LIVE"), serverNow()]);
  const runoffRound = findRound(election.rounds, 2);

  const views = await Promise.all(
    election.rounds.map(async (round) => {
      const [integrity, results] = await Promise.all([
        roundIntegrity(round, now),
        publishedResults(round)
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

      return { round, integrity, results, runoff };
    })
  );

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Resultados</h1>
        <span className="chip chip--activo">Publicación por fases</span>
      </div>

      <p className="aviso">
        No existe vista previa: cada fase se calcula en el servidor en el momento de publicarla. La
        confirmación nunca muestra nombres, posiciones, votos ni porcentajes todavía ocultos.
      </p>

      {views.map((view) => (
        <section key={view.round.id} className="solido tarjeta stack">
          <h2 style={{ margin: 0 }}>{roundLabel(view.round.roundNumber)}</h2>

          <RevealStepper
            roundId={view.round.id}
            roundLabel={roundLabel(view.round.roundNumber)}
            mode={view.round.mode}
            stage={view.round.resultsRevealStage}
            integrity={view.integrity}
            runoff={view.runoff}
            runoffExists={runoffRound !== null}
          />

          {view.results.stage !== "HIDDEN" ? (
            <ResultsBoard results={view.results} roundLabel={roundLabel(view.round.roundNumber)} />
          ) : null}
        </section>
      ))}
    </div>
  );
}
