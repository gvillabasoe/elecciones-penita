import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidacySummary } from "@/components/candidacy/CandidacySummary";
import { requireMember } from "@/lib/auth/current-member";
import { getCandidacy } from "@/lib/election/candidacy";
import { isMemberEligible } from "@/lib/election/eligibility";
import { getElection } from "@/lib/election/state";
import { formatInstant } from "@/lib/time/format";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ candidacyId: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CandidaturaPage({ params }: Props) {
  await requireMember();

  const { candidacyId } = await params;
  if (!UUID_PATTERN.test(candidacyId)) notFound();

  const election = await getElection();
  const candidacy = await getCandidacy(candidacyId);

  if (!candidacy || candidacy.electionId !== election.id) notFound();

  const eligible = await isMemberEligible(election.id, candidacy.presidentId);

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Candidatura</h1>
        <Link href="/eleccion" className="btn btn--fantasma btn--pequeno">
          Volver
        </Link>
      </div>

      <CandidacySummary candidacy={candidacy} votable={eligible && !candidacy.isDeleted} />

      <p className="texto-secundario" style={{ margin: 0 }}>
        Presentada el {formatInstant(candidacy.createdAt)}
      </p>
    </div>
  );
}
