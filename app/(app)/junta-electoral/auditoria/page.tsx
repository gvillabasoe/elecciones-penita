import Link from "next/link";
import type { AuditAction, Prisma } from "@prisma/client";
import { requireBoardMember } from "@/lib/auth/current-member";
import { prisma } from "@/lib/db/prisma";
import { AUDIT_LABELS } from "@/lib/election/audit";
import { getElection, roundLabel } from "@/lib/election/state";
import { formatInstant } from "@/lib/time/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ accion?: string; actor?: string; ronda?: string }>;
}

const ACTION_KEYS = Object.keys(AUDIT_LABELS) as AuditAction[];

/**
 * Auditoría.
 *
 * Registra acciones administrativas con actor, fecha, ronda y entidad. Nunca
 * papeletas individuales, ni la opción votada, ni la relación entre miembro y
 * voto, ni información oculta de resultados, ni credenciales, ni hashes.
 */
export default async function JuntaAuditoriaPage({ searchParams }: PageProps) {
  await requireBoardMember();

  const [election, params] = await Promise.all([getElection("LIVE"), searchParams]);

  const action = ACTION_KEYS.find((key) => key === params.accion) ?? null;
  const roundNumber = Number(params.ronda);
  const round =
    Number.isFinite(roundNumber) && roundNumber > 0
      ? election.rounds.find((item) => item.roundNumber === roundNumber)
      : undefined;

  const where: Prisma.ElectionAuditLogWhereInput = {
    electionId: election.id,
    ...(action ? { action } : {}),
    ...(round ? { roundId: round.id } : {}),
    ...(params.actor
      ? { actor: { normalizedName: { contains: params.actor.toLowerCase() } } }
      : {})
  };

  const entries = await prisma.electionAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
      actor: { select: { displayName: true } },
      round: { select: { roundNumber: true } }
    }
  });

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Auditoría</h1>
        <span className="chip chip--neutro texto-cifra">{entries.length} registros</span>
      </div>

      <form className="solido tarjeta stack stack--s" method="get">
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="filtro-accion">
            Tipo de acción
          </label>
          <select id="filtro-accion" name="accion" className="selector" defaultValue={action ?? ""}>
            <option value="">Todas</option>
            {ACTION_KEYS.map((key) => (
              <option key={key} value={key}>
                {AUDIT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="filtro-actor">
            Actor
          </label>
          <input
            id="filtro-actor"
            name="actor"
            className="entrada"
            type="search"
            autoComplete="off"
            defaultValue={params.actor ?? ""}
            placeholder="Nombre del miembro"
          />
        </div>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="filtro-ronda">
            Ronda
          </label>
          <select id="filtro-ronda" name="ronda" className="selector" defaultValue={params.ronda ?? ""}>
            <option value="">Todas</option>
            {election.rounds.map((item) => (
              <option key={item.id} value={item.roundNumber}>
                {roundLabel(item.roundNumber)}
              </option>
            ))}
          </select>
        </div>

        <div className="fila">
          <button type="submit" className="btn btn--principal btn--pequeno">
            Filtrar
          </button>
          <Link href="/junta-electoral/auditoria" className="btn btn--fantasma btn--pequeno">
            Limpiar
          </Link>
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="vacio">No hay acciones que coincidan con el filtro.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }} className="stack stack--s">
          {entries.map((entry) => (
            <li key={entry.id} className="solido tarjeta tarjeta--compacta">
              <div className="fila fila--separada">
                <span style={{ fontWeight: 600 }}>{AUDIT_LABELS[entry.action]}</span>
                {entry.round ? (
                  <span className="chip chip--neutro">{roundLabel(entry.round.roundNumber)}</span>
                ) : null}
              </div>
              <div className="texto-secundario">
                {entry.actor.displayName} · {formatInstant(entry.createdAt)} · {entry.entityType}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
