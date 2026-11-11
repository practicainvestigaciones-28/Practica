/** Cuántos registros se muestran por página en las listas largas (Asignaciones). */
export const REGISTROS_POR_PAGINA = 10

/** Parte una lista en páginas: devuelve la página válida (nunca pasa de la última) y sus registros. */
export function paginar<T>(lista: T[], paginaPedida: number, porPagina = REGISTROS_POR_PAGINA) {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina))
  const pagina = Math.min(Math.max(1, paginaPedida), totalPaginas)
  return { pagina, totalPaginas, visibles: lista.slice((pagina - 1) * porPagina, pagina * porPagina) }
}
