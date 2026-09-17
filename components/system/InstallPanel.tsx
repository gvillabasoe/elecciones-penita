"use client";

import { useState, useTransition } from "react";
import { installDataAction, installSchemaAction } from "@/app/instalacion/actions";
import { EMPTY_INSTALL_STATE, type InstallActionState } from "@/lib/system/install-state";

interface Props {
  /** Estado actual, calculado en servidor. */
  schemaReady: boolean;
  membersLoaded: number;
  template: string;
}

/**
 * Panel de instalacion.
 *
 * Dos pasos: crear el esquema y cargar los datos iniciales. El token no se
 * guarda en ningun sitio: vive en el estado del componente y viaja en cada
 * accion, que lo vuelve a validar en servidor.
 */
export function InstallPanel({ schemaReady, membersLoaded, template }: Props) {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"random" | "json">("random");
  const [credentials, setCredentials] = useState(template);
  const [state, setState] = useState<InstallActionState>(EMPTY_INSTALL_STATE);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<InstallActionState>) => {
    setState(EMPTY_INSTALL_STATE);
    startTransition(async () => {
      setState(await action());
    });
  };

  const tokenMissing = token.trim().length === 0;

  return (
    <div className="stack">
      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Token de instalación</h2>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="token">
            Valor de SETUP_TOKEN
          </label>
          <input
            id="token"
            className="entrada"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <span className="campo__ayuda">
            El mismo que has puesto en las variables de entorno. No se guarda en el navegador.
          </span>
        </div>
      </section>

      {state.error ? (
        <p className="aviso aviso--error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <div className="solido tarjeta stack stack--s">
          <p className="aviso aviso--exito" role="status" style={{ marginBottom: 0 }}>
            {state.success}
          </p>
          {state.detail.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {state.detail.map((line) => (
                <li key={line} className="texto-secundario">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section className="solido tarjeta stack stack--s">
        <div className="fila fila--separada">
          <h2 style={{ margin: 0 }}>1. Crear el esquema</h2>
          {schemaReady ? <span className="chip chip--activo">hecho</span> : <span className="chip chip--excluido">pendiente</span>}
        </div>
        <p style={{ margin: 0 }}>
          Ejecuta las tres migraciones contra la base de datos y las registra como aplicadas, igual
          que <span className="texto-cifra">prisma migrate deploy</span>. Se puede repetir: las que ya estén
          aplicadas se omiten.
        </p>
        <button
          type="button"
          className="btn btn--principal btn--bloque"
          disabled={pending || tokenMissing}
          onClick={() => run(() => installSchemaAction({ token }))}
        >
          {pending ? "Trabajando…" : "Crear el esquema"}
        </button>
      </section>

      <section className="solido tarjeta stack stack--s">
        <div className="fila fila--separada">
          <h2 style={{ margin: 0 }}>2. Cargar miembros y elecciones</h2>
          {membersLoaded > 0 ? (
            <span className="chip chip--activo texto-cifra">{membersLoaded} cargados</span>
          ) : (
            <span className="chip chip--excluido">pendiente</span>
          )}
        </div>

        {membersLoaded > 0 ? (
          <p className="aviso" style={{ marginBottom: 0 }}>
            Ya hay miembros cargados. Este paso solo puede ejecutarse sobre una base vacía, para que
            nadie pueda reescribir las contraseñas de toda la Peñita desde aquí.
          </p>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Crea los 39 miembros con su contraseña inicial, la elección real y la de ensayo. En base
              de datos solo se guarda el hash bcrypt.
            </p>

            <div className="stack stack--s">
              <label className="opcion">
                <input
                  type="radio"
                  name="modo"
                  checked={mode === "random"}
                  onChange={() => setMode("random")}
                />
                <span className="opcion__cuerpo">
                  <span className="opcion__nombre">Generar contraseñas aleatorias</span>
                  <span className="opcion__meta">
                    Recomendado. Se muestran una única vez en esta pantalla para que las copies.
                  </span>
                </span>
              </label>

              <label className="opcion">
                <input type="radio" name="modo" checked={mode === "json"} onChange={() => setMode("json")} />
                <span className="opcion__cuerpo">
                  <span className="opcion__nombre">Escribirlas yo</span>
                  <span className="opcion__meta">Rellena el valor de cada slug en el cuadro de abajo.</span>
                </span>
              </label>
            </div>

            {mode === "json" ? (
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="credenciales">
                  Contraseñas iniciales
                </label>
                <textarea
                  id="credenciales"
                  className="area"
                  rows={12}
                  spellCheck={false}
                  value={credentials}
                  onChange={(event) => setCredentials(event.target.value)}
                />
                <span className="campo__ayuda">
                  Mínimo 6 caracteres por contraseña. Tienen que estar los 39.
                </span>
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn--principal btn--bloque"
              disabled={pending || tokenMissing}
              onClick={() =>
                run(() =>
                  installDataAction({ token, mode, credentials: mode === "json" ? credentials : undefined })
                )
              }
            >
              {pending ? "Calculando hashes…" : "Cargar miembros y elecciones"}
            </button>
            <p className="texto-secundario" style={{ margin: 0 }}>
              Tarda entre 20 y 60 segundos: son 39 hashes bcrypt. No cierres la pestaña.
            </p>
          </>
        )}
      </section>

      {state.passwords.length > 0 ? (
        <section className="solido tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Contraseñas generadas</h2>
          <p className="aviso" style={{ marginBottom: 0 }}>
            Cópialas ahora. No se guardan en ningún sitio y no se pueden volver a mostrar: en la base
            de datos solo hay hashes.
          </p>
          <ol className="stack stack--s" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {state.passwords.map((entry) => (
              <li key={entry.slug}>
                <span style={{ fontWeight: 600 }}>{entry.displayName}</span>
                <span className="texto-cifra" style={{ display: "block" }}>
                  {entry.password}
                </span>
              </li>
            ))}
          </ol>
          <textarea
            className="area"
            rows={8}
            readOnly
            spellCheck={false}
            value={state.passwords.map((entry) => `${entry.displayName}: ${entry.password}`).join("\n")}
          />
          <p className="texto-secundario" style={{ margin: 0 }}>
            El cuadro de arriba es para seleccionar todo y copiar de una vez.
          </p>
        </section>
      ) : null}

      <section className="solido tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>3. Cerrar la instalación</h2>
        <p style={{ margin: 0 }}>
          Cuando los dos pasos estén hechos, borra la variable <span className="texto-cifra">SETUP_TOKEN</span> en
          el entorno y vuelve a desplegar. Esta página quedará deshabilitada.
        </p>
      </section>
    </div>
  );
}
