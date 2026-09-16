import Link from "next/link";
import { Timeline } from "@/components/election/Timeline";
import { requireBoardMember } from "@/lib/auth/current-member";
import { prisma } from "@/lib/db/prisma";
import { listCandidaciesForBoard } from "@/lib/election/candidacy";
import { listEligibility } from "@/lib/election/eligibility";
import { participationSummary } from "@/lib/election/participation";
import {
  currentRound,
  effectiveStatus,
  findRound,
  getElection,
  hasVotingFinished,
  MODE_LABELS,
  roundLabel,
  serverNow,
  settleExpiredRounds,
  STATUS_LABELS
} from "@/lib/election/state";
import { buildTimeline } from "@/lib/election/timeline";
import { roundIntegrity } from "@/lib/results/integrity";
import { publicFirstPlaceTie } from "@/lib/results/published";
import { formatInstant } from "@/lib/time/format";

export const dynamic = "force-dynamic";

const ACCESOS = [
  { href: "/junta-electoral/candidaturas", label: "Candidaturas", detalle: "Revisión y correcciones" },
  { href: "/junta-electoral/censo", label: "Censo", detalle: "Elegibilidad y exclusiones" },
  { href: "/junta-electoral/votacion", label: "Votación", detalle: "Duración, inicio y estado" },
  { href: "/junta-electoral/resultados", label: "Resultados", detalle: "Publicación por fases" },
  { href: "/junta-electoral/auditoria", label: "Auditoría", detalle: "Registro de acciones" },
  { href: "/junta-electoral/pruebas", label: "Pruebas", detalle: "Simulaciones y ensayos" }
] as const;

/**
 * Dashboard de la Junta Electoral.
 *
 * Resume el estado y dirige a cada subpágina: no concentra la administración.
 * No muestra ningún resultado oculto, solo verificaciones de integridad.
 */
export default async function JuntaElectoralPage() {
  const member = await requireBoardMember();
  await settleExpiredRounds("LIVE");

  const [election, now] = await Promise.all([getElection("LIVE"), serverNow()]);
  const active = currentRound(election.rounds);
  const firstRound = findRound(election.rounds, 1);
  const status = effectiveStatus(active, now);
  const finished = hasVotingFinished(active, now);

  const [eligibility, candidacies, integrity, tie] = await Promise.all([
    listEligibility(election.id),
    listCandidaciesForBoard(election.id),
    roundIntegrity(active, now),
    firstRound ? publicFirstPlaceTie(firstRound) : Promise.resolve(null)
  ]);

  const participation = status === "READY_TO_START" ? null : await participationSummary(active, now);

  const timeline = buildTimeline({
    election,
    now,
    publicFirstPlaceTie: tie === null ? null : tie.isTie
  });

  const excluded = eligibility.filter((row) => !row.isEligible);
  const activeCandidacies = candidacies.filter((row) => !row.isDeleted);
  const pendingReview = activeCandidacies.filter((row) => row.reviewStatus === "PENDING_REVIEW").length;
  const openCorrections = activeCandidacies.filter((row) => row.correctionRequests.length > 0).length;

  const incidencias: string[] = [];
  if (openCorrections > 0) {
    incidencias.push(`${openCorrections} candidatura(s) con corrección pendiente.`);
  }
  if (pendingReview > 0) {
    incidencias.push(`${pendingReview} candidatura(s) sin revisar.`);
  }
  if (finished && !integrity.countsMatch) {
    incidencias.push("El número de participaciones y de papeletas no coincide.");
  }
  if (integrity.orphanBallots > 0) {
    incidencias.push("Hay papeletas que no corresponden a la papeleta congelada.");
  }
  if (active.status === "READY_TO_START" && !active.votingDurationSeconds) {
    incidencias.push("La duración de la votación todavía no está configurada.");
  }

  const auditCount = await prisma.electionAuditLog.count({ where: { electionId: election.id } });

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Junta Electoral</h1>
        <span className="chip chip--activo">{MODE_LABELS[election.mode]}</span>
      </div>

      <p className="texto-secundario" style={{ margin: 0 }}>
        {member.displayName} · Hora del servidor: {formatInstant(now)} (Europe/Madrid)
      </p>

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Estado actual</h2>
        <div className="fila">
          <span className="chip chip--neutro">{roundLabel(active.roundNumber)}</span>
          <span className="chip chip--neutro">{STATUS_LABELS[status]}</span>
          {participation ? (
            <span className="chip chip--neutro texto-cifra">
              {participation.participationCount} de {participation.eligibleVoterCount} han participado
            </span>
          ) : null}
        </div>
        {active.votingClosesAt ? (
          <p className="texto-secundario" style={{ margin: 0 }}>
            Cierre previsto: {formatInstant(active.votingClosesAt)}
          </p>
        ) : null}
      </section>

      <Timeline timeline={timeline} />

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Integridad del recuento</h2>
        <p className="texto-secundario" style={{ margin: 0 }}>
          Verificaciones sin resultados: la Junta Electoral no puede consultar votos, ranking ni
          ganadores antes de publicarlos.
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          <li>Ronda cerrada: {integrity.roundClosed ? "sí" : "no"}</li>
          <li className="texto-cifra">Opciones congeladas: {integrity.optionCount}</li>
          <li className="texto-cifra">Participaciones: {integrity.participationCount}</li>
          <li className="texto-cifra">Papeletas válidas: {integrity.ballotCount}</li>
          <li>Coincidencia: {integrity.countsMatch ? "correcta" : "revisar"}</li>
          <li>Papeletas huérfanas: {integrity.orphanBallots}</li>
          <li>Recuento calculado: {integrity.tallyComputed ? "sí" : "pendiente"}</li>
        </ul>
        {integrity.blockedReason ? <p className="aviso">{integrity.blockedReason}</p> : null}
      </section>

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Incidencias</h2>
        {incidencias.length === 0 ? (
          <p className="vacio">Sin incidencias.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {incidencias.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Resumen</h2>
        <div className="fila">
          <span className="chip chip--activo">{activeCandidacies.length} candidaturas</span>
          <span className="chip chip--neutro">
            {eligibility.length - excluded.length} personas votables
          </span>
          <span className="chip chip--excluido">{excluded.length} excluidas</span>
          <span className="chip chip--neutro texto-cifra">{auditCount} acciones auditadas</span>
        </div>
        <p className="texto-secundario" style={{ margin: 0 }}>
          Plazo de candidaturas:{" "}
          {election.candidacyEditDeadline ? formatInstant(election.candidacyEditDeadline) : "sin fijar"}
        </p>
      </section>

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Secciones</h2>
        <div className="stack stack--s">
          {ACCESOS.map((acceso) => (
            <Link key={acceso.href} href={acceso.href} className="btn btn--fantasma btn--bloque">
              {acceso.label} · {acceso.detalle}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
