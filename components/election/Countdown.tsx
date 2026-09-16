"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { countdownColor, formatRemaining, milestoneLabel } from "@/lib/theme/countdown";

interface Props {
  /** Instante objetivo en ISO, calculado por el servidor. */
  targetIso: string;
  /** Hora del servidor en el momento de renderizar, en ISO. */
  serverNowIso: string;
  /** Duracion total en segundos, para pintar la barra de progreso. */
  totalSeconds?: number | null;
  label: string;
  /** Texto cuando llega a cero. */
  finishedLabel?: string;
  /** Se ejecuta una vez al llegar a cero. */
  onFinished?: () => void;
  /** Aplica los colores de tramo del pliego. Por defecto, si. */
  useTones?: boolean;
}

/**
 * Cuenta atras basada en la hora del servidor.
 *
 * Corrige el desfase del dispositivo: el objetivo se recalcula como
 * "ahora del dispositivo + (objetivo del servidor - ahora del servidor)".
 * La validacion real la hace siempre el servidor.
 */
export function Countdown({
  targetIso,
  serverNowIso,
  totalSeconds,
  label,
  finishedLabel = "Finalizado",
  onFinished,
  useTones = true
}: Props) {
  const offsetMs = useMemo(() => {
    const server = new Date(serverNowIso).getTime();
    return Number.isNaN(server) ? 0 : server - Date.now();
  }, [serverNowIso]);

  const targetMs = useMemo(() => new Date(targetIso).getTime(), [targetIso]);

  const computeRemaining = () => Math.max(0, Math.ceil((targetMs - (Date.now() + offsetMs)) / 1000));

  const [remaining, setRemaining] = useState(computeRemaining);
  const [announcement, setAnnouncement] = useState("");
  const finishedRef = useRef(false);
  const lastMilestoneRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, Math.ceil((targetMs - (Date.now() + offsetMs)) / 1000));
      setRemaining(next);

      const message = milestoneLabel(next);
      if (message && lastMilestoneRef.current !== next) {
        lastMilestoneRef.current = next;
        setAnnouncement(message);
      }

      if (next === 0 && !finishedRef.current) {
        finishedRef.current = true;
        onFinished?.();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [offsetMs, targetMs, onFinished]);

  const tone = useTones ? countdownColor(remaining) : "var(--principal)";
  const progress =
    totalSeconds && totalSeconds > 0 ? Math.min(100, Math.max(0, (remaining / totalSeconds) * 100)) : null;

  return (
    <div style={{ "--tono": tone } as React.CSSProperties}>
      <div className="cuenta">
        <span className="cuenta__cifra">{remaining === 0 ? finishedLabel : formatRemaining(remaining)}</span>
        <span className="cuenta__etiqueta">{label}</span>
      </div>

      {progress !== null ? (
        <div className="cuenta__barra" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {/* Solo se anuncian hitos, nunca cada segundo. */}
      <p aria-live="polite" className="visualmente-oculto">
        {announcement}
      </p>
    </div>
  );
}
