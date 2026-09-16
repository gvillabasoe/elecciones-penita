import type { Diagnostics } from "@/lib/system/diagnostics";

/**
 * Pantalla de puesta en marcha.
 *
 * Solo aparece cuando la aplicacion no puede funcionar. Explica que falta y
 * como arreglarlo, sin mostrar ningun valor de variable de entorno, ninguna
 * cadena de conexion ni el mensaje original del error.
 */
export function SetupNotice({ diagnostics }: { diagnostics: Diagnostics }) {
  const { env, database, schema, seed, failure, problems } = diagnostics;

  const marca = (ok: boolean) => (
    <span className={ok ? "chip chip--activo" : "chip chip--excluido"}>{ok ? "correcto" : "falta"}</span>
  );

  return (
    <div className="app-shell">
      <main
        className="app-main app-main--sin-nav"
        style={{ justifyContent: "center", minHeight: "100dvh" }}
      >
        <header className="stack stack--s">
          <p className="texto-secundario">La Peñita</p>
          <h1>La aplicación no está lista todavía</h1>
        </header>

        {failure ? (
          <section className="solido tarjeta stack stack--s">
            <h2 style={{ margin: 0 }}>Qué ocurre</h2>
            <p style={{ margin: 0 }}>{failure.message}</p>
            <p className="texto-secundario" style={{ margin: 0 }}>
              {failure.hint}
            </p>
          </section>
        ) : null}

        {problems.length > 0 ? (
          <section className="solido tarjeta stack stack--s">
            <h2 style={{ margin: 0 }}>Qué falta por hacer</h2>
            <ol className="stack stack--s" style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ol>
            <p className="texto-secundario" style={{ margin: 0 }}>
              Después de cambiar variables de entorno en Vercel hay que volver a desplegar: se leen al
              arrancar la función, no en cada petición.
            </p>
          </section>
        ) : null}

        <section className="solido tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Comprobaciones</h2>
          <ul className="stack stack--s" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li className="fila fila--separada">
              <span>DATABASE_URL definida</span>
              {marca(env.databaseUrl)}
            </li>
            <li className="fila fila--separada">
              <span>DIRECT_URL definida</span>
              {marca(env.directUrl)}
            </li>
            <li className="fila fila--separada">
              <span>AUTH_SECRET de 32 caracteres o más</span>
              {marca(env.authSecret && env.authSecretLongEnough)}
            </li>
            <li className="fila fila--separada">
              <span>NEXT_PUBLIC_APP_URL definida</span>
              {marca(env.appUrl)}
            </li>
            <li className="fila fila--separada">
              <span>Base de datos accesible</span>
              {marca(database.reachable)}
            </li>
            <li className="fila fila--separada">
              <span className="texto-cifra">
                Tablas encontradas: {schema.tablesFound} de {schema.tablesExpected}
              </span>
              {marca(schema.tablesFound === schema.tablesExpected)}
            </li>
            <li className="fila fila--separada">
              <span className="texto-cifra">Migraciones aplicadas: {schema.migrationsApplied}</span>
              {marca(schema.migrationsApplied >= 3)}
            </li>
            <li className="fila fila--separada">
              <span className="texto-cifra">Miembros cargados: {seed.members}</span>
              {marca(seed.members > 0)}
            </li>
            <li className="fila fila--separada">
              <span>Elección real con primera vuelta</span>
              {marca(seed.firstRound)}
            </li>
            <li className="fila fila--separada">
              <span>Elección de ensayo</span>
              {marca(seed.testElection)}
            </li>
          </ul>
          <p className="texto-secundario" style={{ margin: 0 }}>
            Esta pantalla no muestra ningún valor de configuración, ninguna cadena de conexión ni
            ningún nombre de la Peñita.
          </p>
        </section>

        <section className="solido tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Orden de puesta en marcha</h2>
          <ol className="stack stack--s" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            <li>Variables de entorno en Vercel, en Production y Preview.</li>
            <li>
              <span className="texto-cifra">npm run prisma:deploy</span> con <span className="texto-cifra">DIRECT_URL</span> de
              producción: con la cadena de pooling fallan los disparadores.
            </li>
            <li>
              <span className="texto-cifra">npm run seed</span> una sola vez, con el archivo de credenciales local.
            </li>
            <li>Volver a desplegar y recargar esta página.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
