"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCandidacyAction } from "@/app/(app)/presentar-candidatura/actions";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Switch } from "@/components/ui/Switch";
import type {
  CandidacyFormValues,
  RangeSectionValues,
  SingleSectionValues
} from "@/lib/election/candidacy-form";

export type { CandidacyFormValues, RangeSectionValues, SingleSectionValues };

type OptionalKey = "party" | "event" | "ruralHouse" | "trip" | "weekendGetaway" | "promises";

const OPTIONAL_LABELS: Record<OptionalKey, string> = {
  party: "Fiesta",
  event: "Evento",
  ruralHouse: "Casa Rural",
  trip: "Viaje",
  weekendGetaway: "Escapada de fin de semana",
  promises: "Otras premisas"
};

const emptySingle = (): SingleSectionValues => ({ place: "", startDate: "", description: "" });
const emptyRange = (): RangeSectionValues => ({ place: "", startDate: "", endDate: "", description: "" });

interface Props {
  presidentName: string;
  initial: CandidacyFormValues | null;
  redirectTo?: string;
}

/**
 * Formulario de candidatura.
 *
 * El presidente es de solo lectura: lo determina el servidor a partir de la
 * sesión. Las secciones desactivadas conservan los datos mientras el
 * formulario sigue abierto, avisan antes de apagarse y no se guardan.
 */
export function CandidacyForm({ presidentName, initial, redirectTo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [slogan, setSlogan] = useState(initial?.slogan ?? "");

  const [annual, setAnnual] = useState({
    title: initial?.annualGroupPlan.title ?? "",
    place: initial?.annualGroupPlan.place ?? "",
    startDate: initial?.annualGroupPlan.startDate ?? "",
    description: initial?.annualGroupPlan.description ?? ""
  });
  const [semanaGrande, setSemanaGrande] = useState<SingleSectionValues>(
    initial?.semanaGrandeDinner ?? emptySingle()
  );
  const [christmas, setChristmas] = useState<SingleSectionValues>(
    initial?.christmasDinner ?? emptySingle()
  );

  const [party, setParty] = useState<SingleSectionValues>(initial?.party ?? emptySingle());
  const [event, setEvent] = useState<SingleSectionValues>(initial?.event ?? emptySingle());
  const [ruralHouse, setRuralHouse] = useState<RangeSectionValues>(initial?.ruralHouse ?? emptyRange());
  const [trip, setTrip] = useState<RangeSectionValues>(initial?.trip ?? emptyRange());
  const [weekend, setWeekend] = useState<RangeSectionValues>(initial?.weekendGetaway ?? emptyRange());
  const [promises, setPromises] = useState<string[]>(initial?.promises ?? []);

  const [enabled, setEnabled] = useState<Record<OptionalKey, boolean>>({
    party: Boolean(initial?.party),
    event: Boolean(initial?.event),
    ruralHouse: Boolean(initial?.ruralHouse),
    trip: Boolean(initial?.trip),
    weekendGetaway: Boolean(initial?.weekendGetaway),
    promises: Boolean(initial?.promises && initial.promises.length > 0)
  });

  const [pendingOff, setPendingOff] = useState<OptionalKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sectionHasData = (key: OptionalKey): boolean => {
    switch (key) {
      case "party":
        return Object.values(party).some((value) => value.trim().length > 0);
      case "event":
        return Object.values(event).some((value) => value.trim().length > 0);
      case "ruralHouse":
        return Object.values(ruralHouse).some((value) => value.trim().length > 0);
      case "trip":
        return Object.values(trip).some((value) => value.trim().length > 0);
      case "weekendGetaway":
        return Object.values(weekend).some((value) => value.trim().length > 0);
      case "promises":
        return promises.some((value) => value.trim().length > 0);
      default:
        return false;
    }
  };

  const toggleSection = (key: OptionalKey, next: boolean) => {
    if (!next && sectionHasData(key)) {
      setPendingOff(key);
      return;
    }
    setEnabled((current) => ({ ...current, [key]: next }));
    if (next && key === "promises" && promises.length === 0) setPromises([""]);
  };

  const movePromise = (index: number, direction: -1 | 1) => {
    setPromises((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const a = next[index];
      const b = next[target];
      if (a === undefined || b === undefined) return current;
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const submit = (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanPromises = promises.map((value) => value.trim()).filter((value) => value.length > 0);
    if (enabled.promises && cleanPromises.length === 0) {
      setError("Si activas “Otras premisas”, debe existir al menos una promesa.");
      return;
    }

    const payload = {
      data: {
        name,
        slogan,
        annualGroupPlan: annual,
        semanaGrandeDinner: semanaGrande,
        christmasDinner: christmas,
        party: enabled.party ? party : null,
        event: enabled.event ? event : null,
        ruralHouse: enabled.ruralHouse ? ruralHouse : null,
        trip: enabled.trip ? trip : null,
        weekendGetaway: enabled.weekendGetaway ? weekend : null,
        promises: enabled.promises ? cleanPromises : []
      }
    };

    startTransition(async () => {
      const result = await saveCandidacyAction(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  const singleFields = (
    idPrefix: string,
    values: SingleSectionValues,
    onChange: (next: SingleSectionValues) => void,
    required: boolean
  ) => (
    <>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor={`${idPrefix}-lugar`}>
          Lugar
        </label>
        <input
          id={`${idPrefix}-lugar`}
          className="entrada"
          type="text"
          maxLength={120}
          required={required}
          value={values.place}
          onChange={(e) => onChange({ ...values, place: e.target.value })}
        />
      </div>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor={`${idPrefix}-fecha`}>
          Fecha tentativa
        </label>
        <input
          id={`${idPrefix}-fecha`}
          className="entrada"
          type="date"
          required={required}
          value={values.startDate}
          onChange={(e) => onChange({ ...values, startDate: e.target.value })}
        />
      </div>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor={`${idPrefix}-descripcion`}>
          Descripción
        </label>
        <textarea
          id={`${idPrefix}-descripcion`}
          className="area"
          maxLength={600}
          required={required}
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
        />
      </div>
    </>
  );

  const rangeFields = (
    idPrefix: string,
    values: RangeSectionValues,
    onChange: (next: RangeSectionValues) => void
  ) => (
    <>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor={`${idPrefix}-lugar`}>
          Lugar
        </label>
        <input
          id={`${idPrefix}-lugar`}
          className="entrada"
          type="text"
          maxLength={120}
          required
          value={values.place}
          onChange={(e) => onChange({ ...values, place: e.target.value })}
        />
      </div>
      <div className="rejilla-2">
        <div className="campo">
          <label className="campo__etiqueta" htmlFor={`${idPrefix}-inicio`}>
            Fecha tentativa inicial
          </label>
          <input
            id={`${idPrefix}-inicio`}
            className="entrada"
            type="date"
            required
            value={values.startDate}
            onChange={(e) => onChange({ ...values, startDate: e.target.value })}
          />
        </div>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor={`${idPrefix}-fin`}>
            Fecha tentativa final
          </label>
          <input
            id={`${idPrefix}-fin`}
            className="entrada"
            type="date"
            required
            min={values.startDate || undefined}
            value={values.endDate}
            onChange={(e) => onChange({ ...values, endDate: e.target.value })}
          />
        </div>
      </div>
      {values.startDate && values.endDate && values.endDate < values.startDate ? (
        <p className="campo__error" role="alert">
          La fecha final no puede ser anterior a la inicial.
        </p>
      ) : null}
      <div className="campo">
        <label className="campo__etiqueta" htmlFor={`${idPrefix}-descripcion`}>
          Descripción
        </label>
        <textarea
          id={`${idPrefix}-descripcion`}
          className="area"
          maxLength={600}
          required
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
        />
      </div>
    </>
  );

  return (
    <form className="stack" onSubmit={submit} noValidate={false}>
      {/* --------------------------- Identidad --------------------------- */}
      <section className="cristal tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Candidatura</h2>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="candidatura-nombre">
            Nombre de la candidatura
          </label>
          <input
            id="candidatura-nombre"
            className="entrada"
            type="text"
            maxLength={80}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="candidatura-eslogan">
            Eslogan de la candidatura
          </label>
          <input
            id="candidatura-eslogan"
            className="entrada"
            type="text"
            maxLength={140}
            required
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
          />
        </div>

        <div className="campo">
          <span className="campo__etiqueta">Presidente</span>
          <input className="entrada" type="text" value={presidentName} readOnly aria-readonly="true" />
          <span className="campo__ayuda">
            El presidente se toma de tu sesión y no puede modificarse.
          </span>
        </div>
      </section>

      {/* ---------------------- Propuestas obligatorias ------------------- */}
      <section className="cristal tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Plan de grupo anual</h2>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="anual-titulo">
            Título
          </label>
          <input
            id="anual-titulo"
            className="entrada"
            type="text"
            maxLength={100}
            required
            value={annual.title}
            onChange={(e) => setAnnual({ ...annual, title: e.target.value })}
          />
        </div>
        {singleFields(
          "anual",
          { place: annual.place, startDate: annual.startDate, description: annual.description },
          (next) => setAnnual({ ...annual, ...next }),
          true
        )}
      </section>

      <section className="cristal tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Cena de la Semana Grande de Bilbao</h2>
        {singleFields("semana", semanaGrande, setSemanaGrande, true)}
      </section>

      <section className="cristal tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Cena de Navidad</h2>
        {singleFields("navidad", christmas, setChristmas, true)}
      </section>

      {/* ----------------------- Propuestas opcionales -------------------- */}
      <section className="cristal tarjeta stack stack--s">
        <h2 style={{ margin: 0 }}>Propuestas opcionales</h2>
        <p className="texto-secundario" style={{ margin: 0 }}>
          Activa solo las secciones que quieras incluir. Las secciones desactivadas no se guardan.
        </p>

        {(Object.keys(OPTIONAL_LABELS) as OptionalKey[]).map((key) => (
          <Switch
            key={key}
            id={`switch-${key}`}
            checked={enabled[key]}
            onChange={(next) => toggleSection(key, next)}
            label={OPTIONAL_LABELS[key]}
          />
        ))}
      </section>

      {enabled.party ? (
        <section className="cristal tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Fiesta</h2>
          {singleFields("fiesta", party, setParty, true)}
        </section>
      ) : null}

      {enabled.event ? (
        <section className="cristal tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Evento</h2>
          {singleFields("evento", event, setEvent, true)}
        </section>
      ) : null}

      {enabled.ruralHouse ? (
        <section className="cristal tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Casa Rural</h2>
          {rangeFields("casa", ruralHouse, setRuralHouse)}
        </section>
      ) : null}

      {enabled.trip ? (
        <section className="cristal tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Viaje</h2>
          {rangeFields("viaje", trip, setTrip)}
        </section>
      ) : null}

      {enabled.weekendGetaway ? (
        <section className="cristal tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Escapada de fin de semana</h2>
          {rangeFields("escapada", weekend, setWeekend)}
        </section>
      ) : null}

      {enabled.promises ? (
        <section className="cristal tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>Otras premisas</h2>
          <p className="texto-secundario" style={{ margin: 0 }}>
            Listado de promesas. Puedes añadirlas, editarlas, eliminarlas y reordenarlas.
          </p>

          {promises.length === 0 ? <p className="vacio">Todavía no has añadido ninguna promesa.</p> : null}

          {promises.map((promise, index) => (
            <div key={index} className="stack stack--s">
              <div className="campo">
                <label className="campo__etiqueta" htmlFor={`promesa-${index}`}>
                  Promesa {index + 1}
                </label>
                <input
                  id={`promesa-${index}`}
                  className="entrada"
                  type="text"
                  maxLength={200}
                  value={promise}
                  onChange={(e) =>
                    setPromises((current) => current.map((item, i) => (i === index ? e.target.value : item)))
                  }
                />
              </div>
              <div className="fila">
                <button
                  type="button"
                  className="btn btn--fantasma btn--pequeno"
                  onClick={() => movePromise(index, -1)}
                  disabled={index === 0}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="btn btn--fantasma btn--pequeno"
                  onClick={() => movePromise(index, 1)}
                  disabled={index === promises.length - 1}
                >
                  Bajar
                </button>
                <button
                  type="button"
                  className="btn btn--peligro btn--pequeno"
                  onClick={() => setPromises((current) => current.filter((_, i) => i !== index))}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn--fantasma btn--bloque"
            onClick={() => setPromises((current) => [...current, ""])}
          >
            Añadir promesa
          </button>
        </section>
      ) : null}

      {error ? (
        <p className="aviso aviso--error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="aviso aviso--exito" role="status">
          {success}
        </p>
      ) : null}

      <button type="submit" className="btn btn--principal btn--bloque" disabled={pending} aria-busy={pending}>
        {pending ? "Guardando…" : initial ? "Guardar cambios" : "Presentar candidatura"}
      </button>

      {pendingOff ? (
        <ConfirmSheet
          titulo={`Desactivar “${OPTIONAL_LABELS[pendingOff]}”`}
          confirmLabel="Desactivar sección"
          cancelLabel="Mantener activa"
          destructive
          onConfirm={() => {
            setEnabled((current) => ({ ...current, [pendingOff]: false }));
            setPendingOff(null);
          }}
          onCancel={() => setPendingOff(null)}
        >
          <p>
            Esta sección tiene datos introducidos. Si la desactivas no se guardará al enviar la candidatura.
          </p>
          <p className="texto-secundario">
            Los datos se conservan mientras no cierres el formulario, por si vuelves a activarla.
          </p>
        </ConfirmSheet>
      ) : null}
    </form>
  );
}
