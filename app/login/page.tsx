import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { SetupNotice } from "@/components/system/SetupNotice";
import { getCurrentMember } from "@/lib/auth/current-member";
import { prisma } from "@/lib/db/prisma";
import { collectDiagnostics } from "@/lib/system/diagnostics";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let member = null;
  let members: { slug: string; displayName: string }[] = [];
  let failed = false;

  // Si la base de datos o la configuración fallan, se explica en lugar de
  // devolver un error de servidor sin pistas.
  try {
    member = await getCurrentMember();
    members = await prisma.member.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, displayName: true }
    });
  } catch {
    failed = true;
  }

  if (failed) {
    return <SetupNotice diagnostics={await collectDiagnostics()} />;
  }

  if (member) redirect("/eleccion");

  return (
    <div className="app-shell">
      <main className="app-main app-main--sin-nav" style={{ justifyContent: "center", minHeight: "100dvh" }}>
        <header className="stack stack--s" style={{ marginBottom: "0.5rem" }}>
          <p className="texto-secundario">La Peñita</p>
          <h1>Elecciones a la Presidencia de la Peñita 2027</h1>
        </header>

        {members.length === 0 ? (
          <section className="cristal tarjeta">
            <p>
              Todavía no hay miembros en la base de datos. Ejecuta las migraciones y el seed antes de
              iniciar sesión.
            </p>
          </section>
        ) : (
          <LoginForm members={members} />
        )}

        <p className="texto-secundario" style={{ textAlign: "center" }}>
          Acceso privado. No existe registro público.
        </p>
      </main>
    </div>
  );
}
