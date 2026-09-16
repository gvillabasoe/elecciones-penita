import Link from "next/link";

interface Props {
  candidacyId: string;
  name: string;
  slogan: string;
  presidentName: string;
  color: string;
  votable?: boolean;
  deleted?: boolean;
}

/**
 * Tarjeta compacta de candidatura.
 *
 * El color pastel es persistente. La tarjeta representa una candidatura, que
 * enriquece la opción de voto de su presidente: nunca es una opción aparte.
 */
export function CandidacyCard({
  candidacyId,
  name,
  slogan,
  presidentName,
  color,
  votable = true,
  deleted = false
}: Props) {
  return (
    <Link
      href={`/candidaturas/${candidacyId}`}
      className="cristal tarjeta tarjeta--compacta"
      style={{ display: "block", textDecoration: "none", borderLeft: `4px solid ${color}` }}
    >
      <div className="fila fila--separada">
        <span style={{ fontWeight: 650 }}>{name}</span>
        {deleted ? (
          <span className="chip chip--excluido">Eliminada</span>
        ) : votable ? null : (
          <span className="chip chip--excluido">No votable</span>
        )}
      </div>
      <p className="texto-secundario" style={{ margin: "0.25rem 0 0" }}>
        {slogan}
      </p>
      <p className="texto-secundario" style={{ margin: "0.35rem 0 0" }}>
        Presidente: {presidentName}
      </p>
    </Link>
  );
}
