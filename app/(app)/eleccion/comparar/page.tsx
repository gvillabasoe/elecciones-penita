import Link from "next/link";
import {
  CandidacyComparator,
  type ComparableCandidacy
} from "@/components/candidacy/CandidacyComparator";
import { requireMember } from "@/lib/auth/current-member";
import { listComparableCandidacies } from "@/lib/election/candidacy";
import { RANGE_PROPOSAL_TYPES } from "@/lib/election/proposal-labels";
import { getElection } from "@/lib/election/state";
import { comparisonSchema } from "@/lib/validation/candidacy";
import { formatCalendarDate } from "@/lib/time/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

/**
 * Comparador neutral.
 *
 * Ruta privada: requiere sesión aunque se comparta la URL. Solo incluye
 * candidaturas activas, visibles y válidas para el estado electoral.
 */
export default async function CompararPage({ searchParams }: PageProps) {
  await requireMember();

  const election = await getElection("LIVE");
  const [candidacies, params] = await Promise.all([
    listComparableCandidacies(election.id),
    searchParams
  ]);

  const parsed = comparisonSchema.safeParse(params);
  const initialA = parsed.success ? (parsed.data.a ?? null) : null;
  const initialB = parsed.success ? (parsed.data.b ?? null) : null;

  const comparable: ComparableCandidacy[] = candidacies.map((candidacy) => {
    const sections: ComparableCandidacy["sections"] = {};

    for (const proposal of candidacy.proposals) {
      const isRange = RANGE_PROPOSAL_TYPES.includes(proposal.type);
      const start = formatCalendarDate(proposal.startDate);
      const end = formatCalendarDate(proposal.endDate);

      sections[proposal.type] = {
        title: proposal.title,
        place: proposal.place,
        dates: isRange && end ? `Del ${start} al ${end}` : (start ?? "Fecha por confirmar"),
        description: proposal.description
      };
    }

    return {
      candidacyId: candidacy.id,
      name: candidacy.name,
      slogan: candidacy.slogan,
      presidentName: candidacy.president.displayName,
      color: candidacy.pastelColor,
      sections,
      promises: candidacy.promises.map((promise) => promise.text)
    };
  });

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Comparar candidaturas</h1>
        <span className="chip chip--neutro">{comparable.length} disponibles</span>
      </div>

      {comparable.length < 2 ? (
        <>
          <p className="aviso">
            Hacen falta al menos dos candidaturas para poder compararlas.
          </p>
          <Link href="/eleccion" className="btn btn--fantasma btn--bloque">
            Volver a Elección
          </Link>
        </>
      ) : (
        <CandidacyComparator candidacies={comparable} initialA={initialA} initialB={initialB} />
      )}
    </div>
  );
}
