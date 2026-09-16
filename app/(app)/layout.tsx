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
      <header className="app-header">
        <div className="app-header__inner">
          <div>
            <div className="app-header__titulo">Elecciones Peñita 2027</div>
            <div className="app-header__sub">
              {member.displayName}
              {isBoard ? " · Junta Electoral" : ""}
            </div>
          </div>
          <div className="fila">
            <Link href="/como-funciona" className="btn btn--fantasma btn--pequeno">
              Cómo funciona
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <BottomNav isBoard={isBoard} />
    </div>
  );
}
