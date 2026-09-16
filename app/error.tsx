"use client";

import Link from "next/link";

/**
 * Frontera de error de la aplicación.
 *
 * Sustituye la pantalla en blanco de Next por una explicación y una salida.
 * No muestra el error original: en servidor puede contener datos de conexión.
 * El identificador (digest) sirve para localizarlo en los logs del servidor.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="app-shell">
      <main
        className="app-main app-main--sin-nav"
        style={{ justifyContent: "center", minHeight: "100dvh" }}
      >
        <section className="solido tarjeta stack stack--s">
          <h1 style={{ margin: 0 }}>Algo ha fallado en el servidor</h1>
          <p style={{ margin: 0 }}>
            La página no se ha podido preparar. Si acaba de desplegarse, lo más probable es que falte
            configuración, las migraciones o el seed.
          </p>
          {error.digest ? (
            <p className="texto-secundario texto-cifra" style={{ margin: 0 }}>
              Identificador del error: {error.digest}
            </p>
          ) : null}
          <div className="fila">
            <button type="button" className="btn btn--principal" onClick={() => reset()}>
              Reintentar
            </button>
            <Link href="/estado" className="btn btn--fantasma">
              Ver estado de la instalación
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
