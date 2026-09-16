"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { STATUS_POLL_INTERVAL_MS } from "@/lib/time/constants";

interface Props {
  roundId: string;
  status: string;
  revealStage: string;
}

/**
 * Refresco ligero de la pantalla.
 *
 * Consulta un endpoint de estado y solo recarga los datos del servidor cuando
 * algo ha cambiado (estado de la ronda o fase de resultados). Sin websockets
 * ni infraestructura de tiempo real.
 */
export function StatusRefresher({ roundId, status, revealStage }: Props) {
  const router = useRouter();
  const currentRef = useRef(`${roundId}|${status}|${revealStage}`);

  useEffect(() => {
    currentRef.current = `${roundId}|${status}|${revealStage}`;
  }, [roundId, status, revealStage]);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/election-status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          rounds?: { roundId: string; status: string; revealStage: string }[];
        };
        const current = data.rounds?.find((round) => round.roundId === roundId) ?? data.rounds?.at(-1);
        if (!current || cancelled) return;

        const signature = `${current.roundId}|${current.status}|${current.revealStage}`;
        if (signature !== currentRef.current) {
          currentRef.current = signature;
          router.refresh();
        }
      } catch {
        // Silencioso: en conexiones lentas simplemente se reintenta luego.
      }
    };

    const interval = window.setInterval(check, STATUS_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [roundId, router]);

  return null;
}
