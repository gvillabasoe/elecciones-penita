import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth/current-member";
import { getElection, roundPublicState, serverNow, settleExpiredRounds } from "@/lib/election/state";

export const dynamic = "force-dynamic";

/**
 * Estado electoral para el refresco ligero de la interfaz.
 *
 * Solo informa de la elección REAL. También consolida el cierre de las rondas
 * cuyo plazo ha vencido, con NOW() de PostgreSQL, de modo que no se depende de
 * un cron. No expone resultados ni papeletas: únicamente estado, fase
 * publicada y las horas de referencia.
 */
export async function GET() {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  await settleExpiredRounds("LIVE");

  const [election, now] = await Promise.all([getElection("LIVE"), serverNow()]);

  return NextResponse.json(
    {
      serverNow: now.toISOString(),
      rounds: election.rounds.map((round) => roundPublicState(round, now))
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
