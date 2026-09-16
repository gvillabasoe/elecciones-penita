import type { TallyEntry } from "@/lib/results/ranking";

/**
 * Escenarios ficticios para ensayar la revelacion de resultados.
 *
 * Datos completamente inventados y calculados en memoria: no se leen
 * papeletas, ni participaciones, ni resultados reales, ni se copian tablas
 * LIVE, ni se escribe en la auditoria real.
 */

const FICTIONAL_COLORS = [
  "#BFD9E8",
  "#E8D3BF",
  "#CFE8BF",
  "#E8BFD6",
  "#D6BFE8",
  "#BFE8DF",
  "#E8E2BF",
  "#E0C9C9"
] as const;

interface FakeOption {
  name: string;
  candidacy?: string;
  slogan?: string;
  votes: number;
}

function entries(options: FakeOption[]): TallyEntry[] {
  return options.map((option, index) => ({
    optionId: `ficticio-${index + 1}`,
    memberId: `miembro-ficticio-${index + 1}`,
    memberName: option.name,
    candidacyId: option.candidacy ? `candidatura-ficticia-${index + 1}` : null,
    candidacyName: option.candidacy ?? null,
    slogan: option.slogan ?? null,
    hasFormalCandidacy: Boolean(option.candidacy),
    color: FICTIONAL_COLORS[index % FICTIONAL_COLORS.length] ?? "#BFD9E8",
    sortOrder: index + 1,
    votes: option.votes
  }));
}

export interface Scenario {
  key: string;
  label: string;
  description: string;
  entries: TallyEntry[];
}

const LONG_SLOGAN =
  "Un eslogan deliberadamente largo para comprobar que el diseño no se rompe, que el texto no desborda y que sigue siendo legible en una pantalla estrecha de 320 píxeles";

export const SCENARIOS: Scenario[] = [
  {
    key: "normal",
    label: "1. Resultado normal sin empates",
    description: "Ocho opciones con votos distintos y podio completo.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Norte", slogan: "Más planes", votes: 12 },
      { name: "Opción B", candidacy: "Candidatura Centro", slogan: "Todo en orden", votes: 9 },
      { name: "Opción C", candidacy: "Candidatura Sur", slogan: "Sin excusas", votes: 7 },
      { name: "Opción D", votes: 5 },
      { name: "Opción E", votes: 4 },
      { name: "Opción F", votes: 3 },
      { name: "Opción G", votes: 2 },
      { name: "Opción H", votes: 1 }
    ])
  },
  {
    key: "empate-primero",
    label: "2. Empate en primera posición",
    description: "Dos opciones primeras: no existe segundo puesto y procede segunda vuelta.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Norte", votes: 10 },
      { name: "Opción B", candidacy: "Candidatura Sur", votes: 10 },
      { name: "Opción C", votes: 6 },
      { name: "Opción D", votes: 4 },
      { name: "Opción E", votes: 2 },
      { name: "Opción F", votes: 1 }
    ])
  },
  {
    key: "empate-segundo",
    label: "3. Empate en segunda posición",
    description: "Dos segundos: no existe tercer puesto.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Centro", votes: 11 },
      { name: "Opción B", votes: 7 },
      { name: "Opción C", votes: 7 },
      { name: "Opción D", votes: 3 },
      { name: "Opción E", votes: 2 },
      { name: "Opción F", votes: 1 }
    ])
  },
  {
    key: "empate-tercero",
    label: "4. Empate en tercera posición",
    description: "Dos terceros con bronce compartido.",
    entries: entries([
      { name: "Opción A", votes: 9 },
      { name: "Opción B", votes: 6 },
      { name: "Opción C", votes: 4 },
      { name: "Opción D", votes: 4 },
      { name: "Opción E", votes: 2 },
      { name: "Opción F", votes: 1 }
    ])
  },
  {
    key: "empate-multiple-primero",
    label: "5. Varias opciones empatadas primeras",
    description: "Tres primeras: 1, 1, 1, 4. Todo oro, sin ganador único.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Norte", votes: 8 },
      { name: "Opción B", candidacy: "Candidatura Centro", votes: 8 },
      { name: "Opción C", candidacy: "Candidatura Sur", votes: 8 },
      { name: "Opción D", votes: 3 },
      { name: "Opción E", votes: 1 }
    ])
  },
  {
    key: "menos-de-cinco",
    label: "6. Menos de cinco opciones con votos",
    description: "Solo tres opciones con votos: no hay puestos 4 ni 5.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Norte", votes: 6 },
      { name: "Opción B", votes: 4 },
      { name: "Opción C", votes: 2 },
      { name: "Opción D", votes: 0 },
      { name: "Opción E", votes: 0 }
    ])
  },
  {
    key: "una-opcion",
    label: "7. Una única opción con votos",
    description: "Un solo primer puesto y ninguna otra posición.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Centro", votes: 5 },
      { name: "Opción B", votes: 0 },
      { name: "Opción C", votes: 0 }
    ])
  },
  {
    key: "sin-votos",
    label: "8. Ninguna opción con votos",
    description: "Estado vacío: no hay nada que revelar en ninguna fase.",
    entries: entries([
      { name: "Opción A", votes: 0 },
      { name: "Opción B", votes: 0 },
      { name: "Opción C", votes: 0 }
    ])
  },
  {
    key: "sin-cuarto",
    label: "9. Ausencia de cuarto puesto",
    description: "Empate a tres en tercera posición: el siguiente puesto es el sexto.",
    entries: entries([
      { name: "Opción A", votes: 9 },
      { name: "Opción B", votes: 7 },
      { name: "Opción C", votes: 5 },
      { name: "Opción D", votes: 5 },
      { name: "Opción E", votes: 5 },
      { name: "Opción F", votes: 2 }
    ])
  },
  {
    key: "sin-quinto",
    label: "10. Ausencia de quinto puesto",
    description: "Empate en cuarta posición: no existe quinto puesto.",
    entries: entries([
      { name: "Opción A", votes: 10 },
      { name: "Opción B", votes: 8 },
      { name: "Opción C", votes: 6 },
      { name: "Opción D", votes: 4 },
      { name: "Opción E", votes: 4 },
      { name: "Opción F", votes: 1 }
    ])
  },
  {
    key: "segunda-vuelta",
    label: "11. Segunda vuelta",
    description: "Ronda con solo las dos opciones empatadas y un ganador claro.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Norte", votes: 14 },
      { name: "Opción B", candidacy: "Candidatura Sur", votes: 11 }
    ])
  },
  {
    key: "segunda-vuelta-empatada",
    label: "12. Segunda vuelta nuevamente empatada",
    description: "Empate persistente: no se declara ganador único.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Norte", votes: 12 },
      { name: "Opción B", candidacy: "Candidatura Sur", votes: 12 }
    ])
  },
  {
    key: "muchas-opciones",
    label: "13. Muchas opciones",
    description: "Veinte opciones con votos para comprobar el rendimiento visual.",
    entries: entries(
      Array.from({ length: 20 }, (_, index) => ({
        name: `Opción ${String.fromCharCode(65 + (index % 26))}${index + 1}`,
        votes: 21 - index
      }))
    )
  },
  {
    key: "textos-largos",
    label: "14. Textos largos",
    description: "Nombres y eslóganes extensos a 320 px.",
    entries: entries([
      {
        name: "Opción con un nombre extraordinariamente largo para la prueba",
        candidacy: "Candidatura de nombre igualmente interminable para la prueba visual",
        slogan: LONG_SLOGAN,
        votes: 7
      },
      { name: "Opción B", candidacy: "Candidatura Centro", slogan: LONG_SLOGAN, votes: 5 },
      { name: "Opción C", votes: 3 },
      { name: "Opción D", votes: 2 },
      { name: "Opción E", votes: 1 }
    ])
  },
  {
    key: "movimiento-reducido",
    label: "15. Movimiento reducido",
    description: "Mismo resultado sin animaciones, para comprobar la versión estática.",
    entries: entries([
      { name: "Opción A", candidacy: "Candidatura Norte", votes: 8 },
      { name: "Opción B", votes: 6 },
      { name: "Opción C", votes: 5 },
      { name: "Opción D", votes: 4 },
      { name: "Opción E", votes: 3 },
      { name: "Opción F", votes: 2 }
    ])
  }
];

export const SCENARIO_KEYS = SCENARIOS.map((scenario) => scenario.key);

export function findScenario(key: string | null | undefined): Scenario | null {
  if (!key) return null;
  return SCENARIOS.find((scenario) => scenario.key === key) ?? null;
}
