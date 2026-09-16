import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth/current-member";
import { participationSummary } from "@/lib/election/participation";
import { currentRound, findRound, getElection, serverNow } from "@/lib/election/state";

export const dynamic = "force-dynamic";

/**
 * Participación agregada.
 *
 * Devuelve EXCLUSIVAMENTE totales: nunca registros individuales, nombres,
 * ausentes, orden de participación ni marcas temporales.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("ronda"));

  const [election, now] = await Promise.all([getElection("LIVE"), serverNow()]);
  const round =
    Number.isFinite(requested) && requested > 0
      ? findRound(election.rounds, requested)
      : currentRound(election.rounds);

  if (!round) {
    return NextResponse.json({ error: "La ronda no existe." }, { status: 404 });
  }

  const summary = await participationSummary(round, now);

  return NextResponse.json(
    {
      participationCount: summary.participationCount,
      eligibleVoterCount: summary.eligibleVoterCount,
      participationPercentage: summary.participationPercentage,
      isFinal: summary.isFinal
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
