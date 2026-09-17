import Link from "next/link";
import { InstallPanel } from "@/components/system/InstallPanel";
import { CANONICAL_MEMBERS } from "@/lib/members";
import { collectDiagnostics } from "@/lib/system/diagnostics";
import { credentialsTemplate } from "@/lib/system/install";

export const dynamic = "force-dynamic";
/** 39 hashes bcrypt de coste 12 no caben en los 10 s por defecto. */
export const maxDuration = 60;

/**
 * Instalación desde el navegador.
 *
 * Alternativa completa a `npm run prisma:deploy` + `npm run seed` para quien
 * no tiene entorno local. Deshabilitada mientras no exista SETUP_TOKEN.
 */
export default async function InstalacionPage() {
  const diagnostics = await collectDiagnostics();
  const habilitada = (process.env.SETUP_TOKEN ?? "").length >= 16;
  const schemaReady = diagnostics.schema.tablesFound === diagnostics.schema.tablesExpected;

  return (
    <div className="app-shell">
      <main
        className="app-main app-main--sin-nav"
        style={{ justifyContent: "center", minHeight: "100dvh" }}
      >
        <header className="stack stack--s">
          <p className="texto-secundario">La Peñita</p>
          <h1>Instalación</h1>
          <p style={{ margin: 0 }}>
            Crea el esquema y carga los {CANONICAL_MEMBERS.length} miembros sin necesidad de entorno
            local.
          </p>
        </header>

        {!diagnostics.env.databaseUrl || !diagnostics.database.reachable ? (
          <section className="solido tarjeta stack stack--s">
            <h2 style={{ margin: 0 }}>Falta la conexión</h2>
            <p style={{ margin: 0 }}>
              {diagnostics.failure?.message ?? "La base de datos no responde."}
            </p>
            <p className="texto-secundario" style={{ margin: 0 }}>
              {diagnostics.failure?.hint ?? "Revisa DATABASE_URL en las variables de entorno."}
            </p>
            <Link href="/estado" className="btn btn--fantasma btn--bloque">
              Ver estado de la instalación
            </Link>
          </section>
        ) : !habilitada ? (
          <section className="solido tarjeta stack stack--s">
            <h2 style={{ margin: 0 }}>Instalación deshabilitada</h2>
            <p style={{ margin: 0 }}>
              Define la variable <span className="texto-cifra">SETUP_TOKEN</span> con 16 caracteres o
              más y vuelve a desplegar. Mientras no exista, esta página no puede hacer nada.
            </p>
          </section>
        ) : (
          <InstallPanel
            schemaReady={schemaReady}
            membersLoaded={diagnostics.seed.members}
            template={credentialsTemplate()}
          />
        )}

        <div className="fila">
          <Link href="/estado" className="btn btn--fantasma btn--pequeno">
            Estado
          </Link>
          <Link href="/login" className="btn btn--fantasma btn--pequeno">
            Iniciar sesión
          </Link>
        </div>
      </main>
    </div>
  );
}
