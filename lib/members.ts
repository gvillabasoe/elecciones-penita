/**
 * Lista canonica de miembros de la Penita.
 *
 * `displayName` se conserva tal cual: tildes, comillas, guiones y mayusculas.
 * `slug` es el identificador estable usado en credenciales y URLs.
 * `sortOrder` es la posicion oficial en la lista (1..39).
 *
 * No anadir ni eliminar miembros sin una instruccion expresa.
 */

export type MemberRole = "MEMBER" | "PRESIDENT" | "HONORARY_PRESIDENT";

export interface CanonicalMember {
  sortOrder: number;
  slug: string;
  displayName: string;
  role: MemberRole;
}

export const CANONICAL_MEMBERS: readonly CanonicalMember[] = [
  { sortOrder: 1, slug: "pablo-antepara", displayName: "Pablo Antepara", role: "MEMBER" },
  { sortOrder: 2, slug: "daniel-armas", displayName: "Daniel Armas", role: "MEMBER" },
  { sortOrder: 3, slug: "joaquin-ascarza", displayName: "Joaquin Ascarza", role: "MEMBER" },
  { sortOrder: 4, slug: "gabriel-ayesa", displayName: "Gabriel Ayesa", role: "MEMBER" },
  { sortOrder: 5, slug: "ignacio-barturen", displayName: "Ignacio Barturen", role: "MEMBER" },
  { sortOrder: 6, slug: "eduardo-basanez", displayName: "Eduardo Basáñez", role: "MEMBER" },
  { sortOrder: 7, slug: "juan-cancio", displayName: "Juan Cancio", role: "MEMBER" },
  { sortOrder: 8, slug: "alex-delclaux", displayName: "Alex Delclaux", role: "MEMBER" },
  { sortOrder: 9, slug: "diego-deprit", displayName: "Diego Deprit", role: "MEMBER" },
  { sortOrder: 10, slug: "nicola-forster", displayName: "Nicola Forster", role: "MEMBER" },
  { sortOrder: 11, slug: "juan-garaizabal", displayName: "Juan Garaizabal", role: "MEMBER" },
  { sortOrder: 12, slug: "inigo-gomeza", displayName: "Iñigo Gomeza", role: "PRESIDENT" },
  { sortOrder: 13, slug: "alvaro-goyoaga", displayName: "Álvaro Goyoaga", role: "MEMBER" },
  { sortOrder: 14, slug: "santiago-guerra", displayName: "Santiago Guerra", role: "MEMBER" },
  { sortOrder: 15, slug: "ander-hernandez", displayName: "Ander Hernández", role: "MEMBER" },
  { sortOrder: 16, slug: "luis-iribarren", displayName: "Luis Iribarren", role: "MEMBER" },
  { sortOrder: 17, slug: "asis-landin", displayName: "Asís Landín", role: "MEMBER" },
  { sortOrder: 18, slug: "jaime-leopold", displayName: "Jaime Leopold", role: "MEMBER" },
  { sortOrder: 19, slug: "pablo-martinez", displayName: "Pablo Martínez", role: "MEMBER" },
  { sortOrder: 20, slug: "tomas-molina", displayName: "Tomás Molina", role: "MEMBER" },
  { sortOrder: 21, slug: "gaizka-mouriz", displayName: "Gaizka Mouriz", role: "MEMBER" },
  { sortOrder: 22, slug: "juan-olabarri", displayName: "Juan Olabarri", role: "MEMBER" },
  { sortOrder: 23, slug: "alex-pagadi", displayName: "Alex Pagadi", role: "MEMBER" },
  { sortOrder: 24, slug: "marcos-palomino", displayName: "Marcos Palomino", role: "MEMBER" },
  { sortOrder: 25, slug: "gonzalo-perez", displayName: "Gonzalo Pérez", role: "MEMBER" },
  { sortOrder: 26, slug: "guillermo-pradera", displayName: "Guillermo Pradera", role: "MEMBER" },
  { sortOrder: 27, slug: "oriol-prosper", displayName: "Oriol Prosper", role: "MEMBER" },
  { sortOrder: 28, slug: "pacho-rodriguez-rey", displayName: '"Pacho" Rodríguez-Rey', role: "MEMBER" },
  { sortOrder: 29, slug: "alejo-de-sarria", displayName: "Alejo de Sarría", role: "MEMBER" },
  { sortOrder: 30, slug: "beltran-sendagorta", displayName: "Beltrán Sendagorta", role: "MEMBER" },
  { sortOrder: 31, slug: "fernando-smith", displayName: "Fernando Smith", role: "MEMBER" },
  { sortOrder: 32, slug: "pablo-solaun", displayName: "Pablo Solaun", role: "MEMBER" },
  { sortOrder: 33, slug: "gonzalo-suarez", displayName: "Gonzalo Suárez", role: "MEMBER" },
  { sortOrder: 34, slug: "federico-texido", displayName: "Federico Téxido", role: "MEMBER" },
  { sortOrder: 35, slug: "ignacio-urzay", displayName: "Ignacio Urzay", role: "MEMBER" },
  { sortOrder: 36, slug: "gonzalo-villabaso", displayName: "Gonzalo Villabaso", role: "HONORARY_PRESIDENT" },
  { sortOrder: 37, slug: "alfonso-zabala", displayName: "Alfonso Zabala", role: "MEMBER" },
  { sortOrder: 38, slug: "diego-zumarraga", displayName: "Diego Zumárraga", role: "MEMBER" },
  { sortOrder: 39, slug: "cosme-zurinaga", displayName: "Cosme Zurinaga", role: "MEMBER" }
];

export const MEMBER_COUNT = 39;

export const ELECTION_SLUG = "presidencia-penita-2027";
export const ELECTION_NAME = "Elecciones a la Presidencia de la Peñita 2027";

/** Eleccion de ensayo. Sus datos nunca se mezclan con los de la eleccion real. */
export const ELECTION_TEST_SLUG = "elecciones-penita-2027-pruebas";
export const ELECTION_TEST_NAME = "Elecciones a la Presidencia de la Peñita 2027 (simulación)";
