import { prisma } from "../config/prisma";

export class ConvocatoriaNoEncontradaError extends Error {
  constructor() {
    super("La convocatoria no existe");
  }
}

export class RangoFechasInvalidoError extends Error {
  constructor() {
    super("La fecha de fin debe ser posterior a la fecha de inicio");
  }
}

export class EstadoInvalidoError extends Error {
  constructor(valoresPermitidos: string[]) {
    super(`Estado inválido. Usa uno de: ${valoresPermitidos.join(", ")}`);
  }
}

export const ESTADOS_CONVOCATORIA = ["activa", "cerrada", "inactiva"] as const;
export type EstadoConvocatoria = (typeof ESTADOS_CONVOCATORIA)[number];

export interface DatosConvocatoria {
  nombre: string;
  descripcion?: string;
  fecha_inicio: Date;
  fecha_fin: Date;
}

function validarRangoFechas(fecha_inicio: Date, fecha_fin: Date): void {
  if (fecha_fin <= fecha_inicio) {
    throw new RangoFechasInvalidoError();
  }
}

/** RQF09 - Creación de convocatorias. Nace en estado "activa". */
export async function crearConvocatoria(datos: DatosConvocatoria, creado_por: number) {
  validarRangoFechas(datos.fecha_inicio, datos.fecha_fin);

  return prisma.convocatoria.create({
    data: { ...datos, estado: "activa", creado_por },
  });
}

/** RQF12 - Consulta y listado de convocatorias, con filtro opcional por estado */
export async function listarConvocatorias(filtros: { estado?: string }) {
  return prisma.convocatoria.findMany({
    where: { ...(filtros.estado ? { estado: filtros.estado } : {}) },
    include: { creador: { select: { id_usuario: true, nombre: true, apellido: true } } },
    orderBy: { fecha_creacion: "desc" },
  });
}

/** RQF12 - Consulta de detalle, incluye el conteo de proyectos asociados */
export async function obtenerConvocatoria(id_convocatoria: number) {
  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id_convocatoria },
    include: {
      creador: { select: { id_usuario: true, nombre: true, apellido: true } },
      _count: { select: { proyectos: true } },
    },
  });

  if (!convocatoria) throw new ConvocatoriaNoEncontradaError();
  return convocatoria;
}

/** RQF10 - Actualización de convocatorias (datos generales, no el estado) */
export async function actualizarConvocatoria(
  id_convocatoria: number,
  cambios: Partial<DatosConvocatoria>
) {
  const existente = await prisma.convocatoria.findUnique({ where: { id_convocatoria } });
  if (!existente) throw new ConvocatoriaNoEncontradaError();

  const fecha_inicio = cambios.fecha_inicio ?? existente.fecha_inicio;
  const fecha_fin = cambios.fecha_fin ?? existente.fecha_fin;
  validarRangoFechas(fecha_inicio, fecha_fin);

  return prisma.convocatoria.update({
    where: { id_convocatoria },
    data: cambios,
  });
}

/** RQF11 - Activación y cierre de convocatorias */
export async function cambiarEstadoConvocatoria(id_convocatoria: number, estado: string) {
  if (!ESTADOS_CONVOCATORIA.includes(estado as EstadoConvocatoria)) {
    throw new EstadoInvalidoError([...ESTADOS_CONVOCATORIA]);
  }

  const existente = await prisma.convocatoria.findUnique({ where: { id_convocatoria } });
  if (!existente) throw new ConvocatoriaNoEncontradaError();

  return prisma.convocatoria.update({
    where: { id_convocatoria },
    data: { estado },
  });
}
