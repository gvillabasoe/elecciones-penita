/** Zona horaria funcional de la Penita. */
export const APP_TIME_ZONE = "Europe/Madrid";

/** Duraciones sugeridas para la votacion, en segundos. */
export const VOTING_DURATION_PRESETS = [
  { label: "2 minutos", seconds: 120 },
  { label: "5 minutos", seconds: 300 },
  { label: "10 minutos", seconds: 600 },
  { label: "30 minutos", seconds: 1800 },
  { label: "1 hora", seconds: 3600 },
  { label: "12 horas", seconds: 43200 },
  { label: "24 horas", seconds: 86400 }
] as const;

/** Duraciones sugeridas para la cuenta atras de resultados, en segundos. */
export const RESULTS_COUNTDOWN_PRESETS = [
  { label: "30 segundos", seconds: 30 },
  { label: "1 minuto", seconds: 60 },
  { label: "2 minutos", seconds: 120 },
  { label: "5 minutos", seconds: 300 },
  { label: "10 minutos", seconds: 600 }
] as const;

export const MIN_VOTING_DURATION_SECONDS = 10;
export const MAX_VOTING_DURATION_SECONDS = 604800;
export const MIN_RESULTS_COUNTDOWN_SECONDS = 5;
export const MAX_RESULTS_COUNTDOWN_SECONDS = 604800;

/** Intervalo de refresco de la pantalla Votar, en milisegundos. */
export const STATUS_POLL_INTERVAL_MS = 5000;
