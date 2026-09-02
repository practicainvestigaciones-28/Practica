import type { Request } from "express";

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

export interface ParametrosPaginacion {
  page: number;
  limit: number;
  skip: number;
}

/**
 * RNF02/RNF07 - "evitar que los listados carguen todo de una sola vez".
 * Lee `page`/`limit` de los query params de la petición, con valores por
 * defecto sensatos y un tope máximo para que nadie pida `limit=999999`.
 * Si vienen valores inválidos (no numéricos, negativos, etc.) usa los
 * valores por defecto en vez de fallar — un listado nunca debería romperse
 * por un query param mal formado.
 */
export function obtenerParametrosPaginacion(query: Request["query"]): ParametrosPaginacion {
  const pageRaw = Number(query.page);
  const limitRaw = Number(query.limit);

  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, LIMITE_MAXIMO) : LIMITE_POR_DEFECTO;

  return { page, limit, skip: (page - 1) * limit };
}

export interface RespuestaPaginada<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Envuelve una página de resultados junto con la metadata de paginación. */
export function construirRespuestaPaginada<T>(
  data: T[],
  total: number,
  { page, limit }: ParametrosPaginacion
): RespuestaPaginada<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
