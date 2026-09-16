import Link from "next/link";
import { BallotForm } from "@/components/voting/BallotForm";
import { CandidacyCard } from "@/components/candidacy/CandidacyCard";
import { Countdown } from "@/components/election/Countdown";
import { StatusRefresher } from "@/components/election/StatusRefresher";
import { Timeline } from "@/components/election/Timeline";
import { ResultsBoard } from "@/components/results/ResultsBoard";
import { requireMember } from "@/lib/auth/current-member";
import { listCandidacies } from "@/lib/election/candidacy";
import { listEligibility } from "@/lib/election/eligibility";
import { participationSummary } from "@/lib/election/participation";
import {
  currentRound,
  effectiveStatus,
  findRound,
  getElection,
  hasVotingFinished,
  isVotingOpen,
  roundLabel,
  serverNow,
  settleExpiredRounds,
  STATUS_LABELS
} from "@/lib/election/state";
import { buildTimeline } from "@/lib/election/timeline";
import { publicFirstPlaceTie, publishedResults } from "@/lib/results/published";
import { formatInstant } from "@/lib/time/format";
import { hasVoted, listBallotOptions } from "@/lib/voting/vote";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ronda?: string }>;
}

/**
 * Pantalla Elección.
 *
 * Concentra, según el estado: información previa, línea temporal, papeleta,
 * confirmación, cuentas atrás, participación agregada, resultados publicados
 * e histórico. Solo trabaja con la elección REAL (modo LIVE).
 */
export default async function EleccionPage({ searchParams }: PageProps) {
  const member = await requireMember();
  await settleExpiredRounds("LIVE");

  const [election, now] = await Promise.all([getElection("LIVE"), serverNow()]);
  const params = await searchParams;

  const requestedNumber = Number(params.ronda);
  const requested =
    Number.isFinite(requestedNumber) && requestedNumber > 0
      ? findRound(election.rounds, requestedNumber)
      : null;

  const active = currentRound(election.rounds);
  const round = requested ?? active;
  const firstRound = findRound(election.rounds, 1);

  const status = effectiveStatus(round, now);
  const votingOpen = isVotingOpen(round, now);
  const finished = hasVotingFinished(round, now);

  const tie = firstRound ? await publicFirstPlaceTie(firstRound) : null;
  const timeline = buildTimeline({
    election,
    now,
    publicFirstPlaceTie: tie === null ? null : tie.isTie
  });

  const [voted, participation, results] = await Promise.all([
    hasVoted(round.id, member.id),
    status === "READY_TO_START" ? Promise.resolve(null) : participationSummary(round, now),
    finished ? publishedResults(round) : Promise.resolve(null)
  ]);

  return (
    <div className="stack">
      <StatusRefresher
        roundId={active.id}
        status={effectiveStatus(active, now)}
        revealStage={active.resultsRevealStage}
      />

      <div className="seccion__titulo">
        <h1>{roundLabel(round.roundNumber)}</h1>
        <span className="chip chip--neutro">{STATUS_LABELS[status]}</span>
      </div>

      <div className="fila">
        <Link href="/como-funciona" className="btn btn--fantasma btn--pequeno">
          Cómo funciona
        </Link>
        <Link href="/eleccion/comparar" className="btn btn--fantasma btn--pequeno">
          Comparar candidaturas
        </Link>
      </div>

      <Timeline timeline={timeline} />

      {participation ? (
        <p className="chip chip--neutro texto-cifra">
          Han participado {participation.participationCount} de {participation.eligibleVoterCount}{" "}
          miembros
          {participation.isFinal ? " (definitivo)" : ""}
        </p>
      ) : null}

      {status === "READY_TO_START" ? (
        <>
          <section className="solido tarjeta stack stack--s">
            <h2 style={{ margin: 0 }}>La votación no ha comenzado</h2>
            <p style={{ margin: 0 }}>
              Cuando la Junta Electoral la inicie, podrás votar a un único miembro. Cada miembro votable
              aparece una sola vez: si ha presentado candidatura, podrás consultarla desde su opción.
            </p>
            {election.candidacyEditDeadline ? (
              <p className="texto-secundario" style={{ margin: 0 }}>
                Plazo para presentar o editar candidaturas: {formatInstant(election.candidacyEditDeadline)}
              </p>
            ) : null}
            <Link href="/presentar-candidatura" className="btn btn--principal btn--bloque">
              Presentar o editar mi candidatura
            </Link>
          </section>

          <h2>Candidaturas presentadas</h2>
          <CandidacyList electionId={election.id} />
        </>
      ) : null}

      {votingOpen && round.votingClosesAt ? (
        <>
          <Countdown
            targetIso={round.votingClosesAt.toISOString()}
            serverNowIso={now.toISOString()}
            totalSeconds={round.votingDurationSeconds}
            label="Tiempo restante para votar"
          />

          {voted ? (
            <section className="solido tarjeta stack stack--s">
              <h2 style={{ margin: 0 }}>Tu voto está registrado</h2>
              <p style={{ margin: 0 }}>
                Gracias por participar. Tu papeleta se ha guardado por separado y no contiene ninguna
                referencia a ti, por lo que no es posible mostrarte a quién has votado.
              </p>
              <Link href="/como-funciona" className="btn btn--fantasma btn--bloque">
                Cómo se protege el anonimato
              </Link>
            </section>
          ) : (
            <section className="solido tarjeta">
              <h2>Papeleta</h2>
              <BallotForm roundId={round.id} options={await listBallotOptions(round.id)} />
            </section>
          )}
        </>
      ) : null}

      {finished && results ? (
        <>
          {round.resultsRevealAt && results.stage === "HIDDEN" ? (
            <Countdown
              targetIso={round.resultsRevealAt.toISOString()}
              serverNowIso={now.toISOString()}
              totalSeconds={round.resultsCountdownDurationSeconds}
              label="Los resultados se publicarán por fases"
              finishedLabel="Publicación inminente"
              useTones={false}
            />
          ) : null}

          {results.stage === "HIDDEN" ? (
            <section className="solido tarjeta stack stack--s">
              <h2 style={{ margin: 0 }}>Votación finalizada</h2>
              <p style={{ margin: 0 }}>
                El recuento está cerrado. Los resultados se publicarán por fases: primero el resto de
                posiciones, después los puestos 4 y 5 y por último el podio.
              </p>
              {voted ? null : (
                <p className="texto-secundario" style={{ margin: 0 }}>
                  No consta tu participación en esta ronda.
                </p>
              )}
            </section>
          ) : (
            <ResultsBoard results={results} roundLabel={roundLabel(round.roundNumber)} />
          )}
        </>
      ) : null}

      {election.rounds.length > 1 ? (
        <section className="solido tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Histórico de rondas</h2>
          <div className="fila">
            {election.rounds.map((item) => (
              <Link
                key={item.id}
                href={`/eleccion?ronda=${item.roundNumber}`}
                className={
                  item.roundNumber === round.roundNumber
                    ? "btn btn--acento btn--pequeno"
                    : "btn btn--fantasma btn--pequeno"
                }
              >
                {roundLabel(item.roundNumber)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

async function CandidacyList({ electionId }: { electionId: string }) {
  const [candidacies, eligibility] = await Promise.all([
    listCandidacies(electionId),
    listEligibility(electionId)
  ]);

  const excluded = new Set(
    eligibility.filter((row) => !row.isEligible).map((row) => row.memberId)
  );

  if (candidacies.length === 0) {
    return <p className="vacio">Todavía no se ha presentado ninguna candidatura.</p>;
  }

  return (
    <div className="stack stack--s">
      {candidacies.map((candidacy) => (
        <CandidacyCard
          key={candidacy.id}
          candidacyId={candidacy.id}
          name={candidacy.name}
          slogan={candidacy.slogan}
          presidentName={candidacy.president.displayName}
          color={candidacy.pastelColor}
          votable={!excluded.has(candidacy.presidentId)}
        />
      ))}
    </div>
  );
}
