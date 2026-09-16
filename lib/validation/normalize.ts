/**
 * Normalizacion de texto para busquedas tolerantes.
 *
 * Objetivo: que "alvaro", "inigo", "pacho" o "rodriguez rey" encuentren al
 * miembro correcto sin importar tildes, dieresis, comillas o guiones.
 */

/** Quita tildes y dieresis, pasa a minusculas y deja solo letras, numeros y espacios. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''""`´]/g, "")
    .replace(/[-_/.,]/g, " ")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre normalizado que se guarda en base de datos para indexar busquedas. */
export function normalizeName(displayName: string): string {
  return normalizeText(displayName);
}

/**
 * Compara una consulta libre con un nombre visible.
 * Coincide si todos los fragmentos de la consulta aparecen en el nombre.
 */
export function matchesQuery(displayName: string, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length === 0) return true;

  const haystack = normalizeText(displayName);
  return normalizedQuery
    .split(" ")
    .every((fragment) => haystack.includes(fragment));
}

/** Filtra y ordena una lista de elementos con nombre visible. */
export function filterByQuery<T extends { displayName: string }>(items: readonly T[], query: string): T[] {
  return items.filter((item) => matchesQuery(item.displayName, query));
}
