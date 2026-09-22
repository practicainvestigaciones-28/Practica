import { prisma } from "../config/prisma";

export class ConvocatoriaNoEncontradaError extends Error {
  constructor() {
    super("La convocatoria indicada no existe");
  }
}

export class TipoCatalogoInvalidoError extends Error {
  constructor(tipo: string) {
    super(`Tipo de catálogo desconocido: ${tipo}`);
  }
}

export class ItemCatalogoInvalidoError extends Error {
  constructor() {
    super("Uno o más elementos seleccionados no existen en el catálogo indicado");
  }
}

const TIPOS_VALIDOS = [
  "periodo",
  "programa",
  "facultad",
  "grupo",
  "linea",
  "ods",
  "area",
  "modalidad",
  "tipo_proyecto",
  "categoria_producto",
] as const;

export type TipoOpcionConvocatoria = (typeof TIPOS_VALIDOS)[number];

function esTipoValido(tipo: string): tipo is TipoOpcionConvocatoria {
  return (TIPOS_VALIDOS as readonly string[]).includes(tipo);
}

async function idsExistentesDelCatalogo(tipo: TipoOpcionConvocatoria, ids: number[]): Promise<Set<number>> {
  switch (tipo) {
    case "periodo": {
      const filas = await prisma.periodo.findMany({ where: { id_periodo: { in: ids } }, select: { id_periodo: true } });
      return new Set(filas.map((f) => f.id_periodo));
    }
    case "programa": {
      const filas = await prisma.programa.findMany({ where: { id_programa: { in: ids } }, select: { id_programa: true } });
      return new Set(filas.map((f) => f.id_programa));
    }
    case "facultad": {
      const filas = await prisma.facultad.findMany({ where: { id_facultad: { in: ids } }, select: { id_facultad: true } });
      return new Set(filas.map((f) => f.id_facultad));
    }
    case "grupo": {
      const filas = await prisma.grupoInvestigacion.findMany({ where: { id_grupo: { in: ids } }, select: { id_grupo: true } });
      return new Set(filas.map((f) => f.id_grupo));
    }
    case "linea": {
      const filas = await prisma.lineaInvestigacion.findMany({ where: { id_linea: { in: ids } }, select: { id_linea: true } });
      return new Set(filas.map((f) => f.id_linea));
    }
    case "ods": {
      const filas = await prisma.ods.findMany({ where: { id_ods: { in: ids } }, select: { id_ods: true } });
      return new Set(filas.map((f) => f.id_ods));
    }
    case "area": {
      const filas = await prisma.areaConocimiento.findMany({
        where: { id_area_conocimiento: { in: ids } },
        select: { id_area_conocimiento: true },
      });
      return new Set(filas.map((f) => f.id_area_conocimiento));
    }
    case "modalidad": {
      const filas = await prisma.modalidadProyecto.findMany({ where: { id_modalidad: { in: ids } }, select: { id_modalidad: true } });
      return new Set(filas.map((f) => f.id_modalidad));
    }
    case "tipo_proyecto": {
      const filas = await prisma.tipoProyecto.findMany({
        where: { id_tipo_proyecto: { in: ids } },
        select: { id_tipo_proyecto: true },
      });
      return new Set(filas.map((f) => f.id_tipo_proyecto));
    }
    case "categoria_producto": {
      const filas = await prisma.categoriaProducto.findMany({ where: { id_categoria: { in: ids } }, select: { id_categoria: true } });
      return new Set(filas.map((f) => f.id_categoria));
    }
  }
}

async function verificarConvocatoria(id_convocatoria: number): Promise<void> {
  const existente = await prisma.convocatoria.findUnique({ where: { id_convocatoria } });
  if (!existente) throw new ConvocatoriaNoEncontradaError();
}

/**
 * Opciones configuradas para una convocatoria, agrupadas por tipo de
 * catálogo. Sin `tipo`, devuelve todos los tipos configurados; un tipo sin
 * filas significa "sin restricción" (Crear Proyecto debe mostrar el
 * catálogo global activo completo para ese tipo).
 */
export async function obtenerOpciones(id_convocatoria: number, tipo?: string): Promise<Record<string, number[]>> {
  await verificarConvocatoria(id_convocatoria);
  if (tipo && !esTipoValido(tipo)) throw new TipoCatalogoInvalidoError(tipo);

  const filas = await prisma.convocatoriaOpcion.findMany({
    where: { id_convocatoria, ...(tipo ? { tipo } : {}) },
  });

  const agrupado: Record<string, number[]> = {};
  for (const fila of filas) {
    (agrupado[fila.tipo] ??= []).push(fila.id_item);
  }
  return agrupado;
}

/** Reemplaza el conjunto completo de opciones seleccionadas para un tipo de catálogo en una convocatoria. Solo Administrador. */
export async function reemplazarOpciones(id_convocatoria: number, tipo: string, ids: number[]) {
  await verificarConvocatoria(id_convocatoria);
  if (!esTipoValido(tipo)) throw new TipoCatalogoInvalidoError(tipo);

  const idsUnicos = [...new Set(ids)];
  if (idsUnicos.length > 0) {
    const existentes = await idsExistentesDelCatalogo(tipo, idsUnicos);
    if (existentes.size !== idsUnicos.length) throw new ItemCatalogoInvalidoError();
  }

  await prisma.$transaction([
    prisma.convocatoriaOpcion.deleteMany({ where: { id_convocatoria, tipo } }),
    prisma.convocatoriaOpcion.createMany({
      data: idsUnicos.map((id_item) => ({ id_convocatoria, tipo, id_item })),
    }),
  ]);

  return { tipo, ids: idsUnicos };
}

/** Límites de caracteres por campo de texto configurados para una convocatoria. */
export async function obtenerLimitesTexto(id_convocatoria: number) {
  await verificarConvocatoria(id_convocatoria);
  return prisma.convocatoriaLimiteTexto.findMany({ where: { id_convocatoria } });
}

/** Reemplaza el conjunto completo de límites de texto de una convocatoria. Solo Administrador. */
export async function reemplazarLimitesTexto(
  id_convocatoria: number,
  limites: { clave: string; max_caracteres: number }[]
) {
  await verificarConvocatoria(id_convocatoria);

  await prisma.$transaction([
    prisma.convocatoriaLimiteTexto.deleteMany({ where: { id_convocatoria } }),
    prisma.convocatoriaLimiteTexto.createMany({
      data: limites.map((l) => ({ id_convocatoria, clave: l.clave, max_caracteres: l.max_caracteres })),
    }),
  ]);

  return limites;
}
