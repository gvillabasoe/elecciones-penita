import { collectDiagnostics } from "@/lib/system/diagnostics";
import { SetupNotice } from "@/components/system/SetupNotice";

export const dynamic = "force-dynamic";

/**
 * Estado de la instalación.
 *
 * Pensada para la puesta en marcha: dice si faltan variables, migraciones o
 * seed sin necesidad de abrir los logs de Vercel. No expone valores de
 * configuración ni datos de la elección. Puede borrarse cuando la aplicación
 * ya funcione.
 */
export default async function EstadoPage() {
  const diagnostics = await collectDiagnostics();

  if (diagnostics.ready) {
    return (
      <div className="app-shell">
        <main
          className="app-main app-main--sin-nav"
          style={{ justifyContent: "center", minHeight: "100dvh" }}
        >
          <section className="solido tarjeta stack stack--s">
            <h1 style={{ margin: 0 }}>Todo listo</h1>
            <p style={{ margin: 0 }}>
              La base de datos responde, las migraciones están aplicadas y los miembros están
              cargados.
            </p>
            <div className="fila">
              <span className="chip chip--activo texto-cifra">{diagnostics.seed.members} miembros</span>
              <span className="chip chip--activo texto-cifra">
                {diagnostics.schema.migrationsApplied} migraciones
              </span>
            </div>
            <a className="btn btn--principal btn--bloque" href="/login">
              Ir a iniciar sesión
            </a>
          </section>
        </main>
      </div>
    );
  }

  return <SetupNotice diagnostics={diagnostics} />;
}
