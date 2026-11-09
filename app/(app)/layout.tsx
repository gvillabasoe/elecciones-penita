import Link from "next/link";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LogoutButton } from "@/components/navigation/LogoutButton";
import { requireMember } from "@/lib/auth/current-member";
import { isBoardRole } from "@/lib/authorization/board";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const isBoard = isBoardRole(member.role);

  return (
    <div className="app-shell">
      <a href="#contenido" className="salto">
        Saltar al contenido
      </a>

      <header className="app-header">
        <div className="app-header__inner">
          <Link href="/eleccion" className="app-header__marca" aria-label="Elecciones Peñita 2027, ir a la elección">
            <span className="app-header__logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <span className="app-header__texto">
              <span className="app-header__titulo" style={{ display: "block" }}>
                Elecciones Peñita 2027
              </span>
              <span className="app-header__sub" style={{ display: "block" }}>
                {member.displayName}
                {isBoard ? " · Junta Electoral" : ""}
              </span>
            </span>
          </Link>
          <div className="fila" style={{ flexWrap: "nowrap" }}>
            <Link href="/como-funciona" className="btn btn--fantasma btn--pequeno">
              Cómo funciona
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="app-main">
        {children}
      </main>

      <BottomNav isBoard={isBoard} />
    </div>
  );
}
