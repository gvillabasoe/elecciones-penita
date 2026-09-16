"use client";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  id?: string;
  disabled?: boolean;
}

/** Switch accesible: boton con role="switch" y aria-checked. */
export function Switch({ checked, onChange, label, description, id, disabled = false }: Props) {
  const descriptionId = description && id ? `${id}-ayuda` : undefined;

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-describedby={descriptionId}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span>
        <span style={{ fontWeight: 600, display: "block" }}>{label}</span>
        {description ? (
          <span id={descriptionId} className="texto-secundario">
            {description}
          </span>
        ) : null}
      </span>
      <span className="switch__pista" aria-hidden="true">
        <span className="switch__bola" />
      </span>
    </button>
  );
}
