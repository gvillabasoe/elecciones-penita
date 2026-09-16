"use client";

/**
 * Frontera de error de último recurso: cubre también los fallos del layout
 * raíz, por lo que debe traer su propio <html> y no puede usar los estilos
 * de la aplicación.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#ffffff",
          color: "#1a4756",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        }}
      >
        <div style={{ maxWidth: "26rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
            Elecciones Peñita 2027 no ha podido arrancar
          </h1>
          <p style={{ lineHeight: 1.5, marginBottom: "0.75rem" }}>
            Revisa las variables de entorno, las migraciones y el seed. La página{" "}
            <a href="/estado" style={{ color: "#1a4756" }}>
              /estado
            </a>{" "}
            indica qué falta.
          </p>
          {error.digest ? (
            <p style={{ fontSize: "0.8125rem", opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
              Identificador del error: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "0.5rem",
              minHeight: "44px",
              padding: "0 1rem",
              borderRadius: "999px",
              border: "1px solid #1a4756",
              background: "#1a4756",
              color: "#ffffff",
              font: "inherit",
              cursor: "pointer"
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
