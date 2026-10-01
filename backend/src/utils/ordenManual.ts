import { prisma } from "../config/prisma";

/** Compartido por todos los catálogos que se pueden reordenar por arrastre (ver productos.service.ts, el original). */
export class OrdenInvalidoError extends Error {
  constructor() {
    super("La lista de ids a reordenar no coincide con los elementos existentes");
  }
}

interface DelegadoConOrden {
  findMany: (args: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any>;
  update: (args: any) => any;
}

/** Calcula el `orden` para un registro nuevo: al final de los existentes (filtrados por `where` si aplica). */
export async function obtenerSiguienteOrden(delegado: DelegadoConOrden, where?: Record<string, unknown>): Promise<number> {
  const ultimo = await delegado.findFirst({ where, orderBy: { orden: "desc" } });
  return (ultimo?.orden ?? -1) + 1;
}

/** Reordena los registros de `delegado` según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarLista(
  delegado: DelegadoConOrden,
  idField: string,
  ids: number[],
  where?: Record<string, unknown>
): Promise<void> {
  const existentes = await delegado.findMany({ where, select: { [idField]: true } });
  const idsExistentes = new Set(existentes.map((e) => e[idField]));
  if (ids.length !== idsExistentes.size || !ids.every((id) => idsExistentes.has(id))) {
    throw new OrdenInvalidoError();
  }

  await prisma.$transaction(ids.map((id, i) => delegado.update({ where: { [idField]: id }, data: { orden: i } })));
}
