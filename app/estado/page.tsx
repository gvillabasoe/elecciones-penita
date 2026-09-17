import { randomBytes } from "node:crypto";
import Link from "next/link";
import { SetupNotice } from "@/components/system/SetupNotice";
import { collectDiagnostics } from "@/lib/system/diagnostics";

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

  // Sugerencias aleatorias: sirven para no depender de una terminal. Cambian en
  // cada recarga y solo se convierten en secreto si se adoptan.
  const suggestions = {
    authSecret: randomBytes(48).toString("base64url"),
    setupToken: randomBytes(24).toString("base64url")
  };
  const needsSecrets = !diagnostics.env.authSecret || !diagnostics.env.authSecretLongEnough;

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
            <Link className="btn btn--principal btn--bloque" href="/login">
              Ir a iniciar sesión
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <>
      <SetupNotice diagnostics={diagnostics} />

      <div className="app-shell">
        <main className="app-main app-main--sin-nav">
          <section className="solido tarjeta stack stack--s">
            <h2 style={{ margin: 0 }}>Instalar sin línea de comandos</h2>
            <p style={{ margin: 0 }}>
              Si no puedes ejecutar nada en tu ordenador, la página de instalación crea las tablas y
              carga los miembros desde el navegador. Necesita una variable{" "}
              <span className="texto-cifra">SETUP_TOKEN</span> en el entorno.
            </p>
            <Link href="/instalacion" className="btn btn--principal btn--bloque">
              Ir a la instalación
            </Link>
          </section>

          {needsSecrets ? (
            <section className="solido tarjeta stack stack--s">
              <h2 style={{ margin: 0 }}>Valores aleatorios listos para copiar</h2>
              <p className="texto-secundario" style={{ margin: 0 }}>
                Generados ahora mismo en el servidor, por si no tienes una terminal a mano. Cambian
                cada vez que recargas: copia el que uses antes de salir de esta página.
              </p>
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="sugerencia-auth">
                  AUTH_SECRET
                </label>
                <textarea id="sugerencia-auth" className="area" rows={2} readOnly value={suggestions.authSecret} />
              </div>
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="sugerencia-token">
                  SETUP_TOKEN
                </label>
                <textarea id="sugerencia-token" className="area" rows={2} readOnly value={suggestions.setupToken} />
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </>
  );
}
