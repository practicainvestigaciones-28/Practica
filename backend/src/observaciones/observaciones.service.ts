import { prisma } from "../config/prisma";
import { ProyectoNoEncontradoError } from "../utils/permisosProyecto";
export { ProyectoNoEncontradoError } from "../utils/permisosProyecto";

export class DocumentoNoEncontradoError extends Error {
  constructor() {
    super("El documento no existe en este proyecto");
  }
}

export class EtapaNoEncontradaError extends Error {
  constructor() {
    super("La etapa indicada no existe");
  }
}

export class ObservacionNoEncontradaError extends Error {
  constructor() {
    super("La observación no existe en este proyecto");
  }
}

export class NoAutorizadoObservacionError extends Error {
  constructor() {
    super("Solo quien escribió la observación o un administrador pueden eliminarla");
  }
}

const INCLUDE_OBSERVACION = {
  etapa: true,
  usuario: { select: { id_usuario: true, nombre: true, apellido: true } },
  proyectoDocumento: {
    select: {
      id_proyecto_documento: true,
      id_proyecto: true,
      archivo: true,
      aprobado_rechazado: true,
      tipoDocumento: { select: { id_tipo_documento: true, nombre: true } },
    },
  },
} as const;

/** Confirma que el documento exista Y pertenezca a ese proyecto (no basta con que exista). */
async function verificarDocumentoDelProyecto(id_proyecto: number, id_proyecto_documento: number) {
  const documento = await prisma.proyectoDocumento.findUnique({
    where: { id_proyecto_documento },
  });
  if (!documento || documento.id_proyecto !== id_proyecto) throw new DocumentoNoEncontradoError();
  return documento;
}

export interface DatosObservacion {
  id_etapa: number;
  id_usuario: number;
  observacion: string;
  archivo_adjunto?: string;
}

/**
 * RQF40/RQF60 - Registra una observación sobre un documento cargado, dejando
 * constancia de en qué etapa del proceso se hizo (general/inicial, comité de
 * investigación, ética...). Es lo que le dice al investigador QUÉ debe
 * corregir cuando su documento no es aprobado.
 */
export async function crearObservacion(
  id_proyecto: number,
  id_proyecto_documento: number,
  datos: DatosObservacion
) {
  await verificarDocumentoDelProyecto(id_proyecto, id_proyecto_documento);

  const etapa = await prisma.etapa.findUnique({ where: { id_etapa: datos.id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

  return prisma.observacionProyecto.create({
    data: {
      proyecto_documento: id_proyecto_documento,
      id_etapa: datos.id_etapa,
      id_usuario: datos.id_usuario,
      observacion: datos.observacion,
      archivo_adjunto: datos.archivo_adjunto,
    },
    include: INCLUDE_OBSERVACION,
  });
}

/** RQF40 - Observaciones de un documento puntual del proyecto. */
export async function listarObservacionesDocumento(
  id_proyecto: number,
  id_proyecto_documento: number
) {
  await verificarDocumentoDelProyecto(id_proyecto, id_proyecto_documento);

  return prisma.observacionProyecto.findMany({
    where: { proyecto_documento: id_proyecto_documento },
    include: INCLUDE_OBSERVACION,
    orderBy: { fecha_observacion: "desc" },
  });
}

/**
 * RQF60 - Todas las observaciones del proyecto, opcionalmente filtradas por
 * etapa. Como las observaciones cuelgan del documento y no del proyecto, el
 * filtro se hace a través de la relación (documentos cuyo id_proyecto sea
 * este), no con un id_proyecto directo.
 */
export async function listarObservacionesProyecto(
  id_proyecto: number,
  filtros: { id_etapa?: number } = {}
) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  return prisma.observacionProyecto.findMany({
    where: {
      proyectoDocumento: { id_proyecto },
      ...(filtros.id_etapa ? { id_etapa: filtros.id_etapa } : {}),
    },
    include: INCLUDE_OBSERVACION,
    orderBy: { fecha_observacion: "desc" },
  });
}

/**
 * Elimina una observación. Solo el autor o un Administrador — una observación
 * es la constancia de lo que pidió corregir un revisor, así que no debería
 * poder borrarla cualquiera que pase por ahí.
 */
export async function eliminarObservacion(
  id_proyecto: number,
  id_observacion: number,
  usuarioQueElimina: { id_usuario: number; roles: string[] }
): Promise<void> {
  const observacion = await prisma.observacionProyecto.findUnique({
    where: { id_observacion },
    include: { proyectoDocumento: { select: { id_proyecto: true } } },
  });

  if (!observacion || observacion.proyectoDocumento.id_proyecto !== id_proyecto) {
    throw new ObservacionNoEncontradaError();
  }

  const esAutor = observacion.id_usuario === usuarioQueElimina.id_usuario;
  const esAdmin = usuarioQueElimina.roles.includes("Administrador");
  if (!esAutor && !esAdmin) throw new NoAutorizadoObservacionError();

  await prisma.observacionProyecto.delete({ where: { id_observacion } });
}
