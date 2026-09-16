"use client";

import { useId, useMemo, useRef, useState } from "react";
import { matchesQuery } from "@/lib/validation/normalize";

export interface MemberOption {
  slug: string;
  displayName: string;
}

interface Props {
  members: readonly MemberOption[];
  value: string;
  onChange: (slug: string) => void;
}

/**
 * Selector buscable de miembro.
 *
 * Busca por nombre, apellido y fragmentos, ignorando mayusculas, tildes,
 * dieresis, comillas, guiones y espacios sobrantes. Funciona con teclado y
 * con interaccion tactil.
 */
export function MemberCombobox({ members, value, onChange }: Props) {
  const baseId = useId();
  const listId = `${baseId}-lista`;
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = members.find((member) => member.slug === value) ?? null;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const filtered = members.filter((member) => matchesQuery(member.displayName, query));
    return filtered.slice(0, 40);
  }, [members, query]);

  const select = (slug: string) => {
    onChange(slug);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      const candidate = results[activeIndex];
      if (open && candidate) {
        event.preventDefault();
        select(candidate.slug);
      }
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={`${baseId}-entrada`}>
        Tu nombre
      </label>

      {selected ? (
        <div className="fila fila--separada">
          <span className="chip chip--activo">{selected.displayName}</span>
          <button
            type="button"
            className="btn btn--fantasma btn--pequeno"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
              window.requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            Cambiar
          </button>
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={`${baseId}-entrada`}
        className="entrada"
        type="text"
        role="combobox"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[activeIndex] ? `${baseId}-opcion-${activeIndex}` : undefined}
        placeholder={selected ? "Buscar otro nombre" : "Escribe tu nombre o apellido"}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      <input type="hidden" name="slug" value={value} />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Miembros de la Peñita"
          className="stack stack--s"
          style={{
            listStyle: "none",
            margin: "0.25rem 0 0",
            padding: 0,
            maxHeight: "16rem",
            overflowY: "auto"
          }}
        >
          {results.length === 0 ? (
            <li className="texto-secundario" style={{ padding: "0.5rem 0.25rem" }}>
              Ningún nombre coincide con la búsqueda.
            </li>
          ) : (
            results.map((member, index) => (
              <li key={member.slug} role="none">
                <button
                  type="button"
                  id={`${baseId}-opcion-${index}`}
                  role="option"
                  aria-selected={member.slug === value}
                  className="opcion"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    font: "inherit",
                    color: "inherit",
                    background: index === activeIndex ? "rgba(0, 173, 140, 0.08)" : undefined
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(member.slug)}
                >
                  <span className="opcion__cuerpo">
                    <span className="opcion__nombre">{member.displayName}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
