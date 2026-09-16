"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { MemberCombobox, type MemberOption } from "@/components/auth/MemberCombobox";
import { SubmitButton } from "@/components/ui/SubmitButton";

const ESTADO_INICIAL: LoginState = { error: null };

export function LoginForm({ members }: { members: MemberOption[] }) {
  const [state, formAction] = useActionState(loginAction, ESTADO_INICIAL);
  const [slug, setSlug] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="cristal tarjeta stack">
      <p>Selecciona tu nombre e introduce tu contraseña.</p>

      <MemberCombobox members={members} value={slug} onChange={setSlug} />

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="password">
          Contraseña
        </label>
        <div className="fila" style={{ gap: "0.5rem", flexWrap: "nowrap" }}>
          <input
            id="password"
            name="password"
            className="entrada"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            required
            aria-describedby={state.error ? "login-error" : undefined}
          />
          <button
            type="button"
            className="btn btn--fantasma btn--pequeno"
            onClick={() => setVisible((current) => !current)}
            aria-pressed={visible}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {state.error ? (
        <p id="login-error" className="aviso aviso--error" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Iniciando sesión…" disabled={slug.length === 0}>
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}
