import { BoardNav } from "@/components/board/BoardNav";
import { requireBoardMember } from "@/lib/auth/current-member";

export const dynamic = "force-dynamic";

/**
 * Junta Electoral.
 *
 * Una única pestaña principal con navegación interna. La protección de rol se
 * repite aquí y, de nuevo, en cada página y en cada Server Action: proteger
 * solo el layout no sería suficiente.
 */
export default async function JuntaLayout({ children }: { children: React.ReactNode }) {
  await requireBoardMember();

  return (
    <div className="stack">
      <BoardNav />
      {children}
    </div>
  );
}
