import { prisma } from "../config/prisma";
import { obtenerSiguienteOrden, reordenarLista } from "../utils/ordenManual";

export class GrupoNoEncontradoError extends Error {
  constructor() {
    super("El grupo de investigación no existe");
  }
}

export class GrupoEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay proyectos que ya usan este grupo de investigación");
  }
}

export interface DatosGrupoInvestigacion {
  nombre: string;
  id_tipo_grupo: number;
  id_facultad?: number | null;
  id_programa?: number | null;
  id_dedicacion?: number | null;
  facultad_otra?: string | null;
  programa_otro?: string | null;
  lider_grupo?: string | null;
  cod_gruplac?: string | null;
  reconocido_minciencias?: boolean;
  categoria?: string | null;
  acuerdo_institucional?: string | null;
  linea_medular?: string | null;
}

/** RQF23 - Registrar un grupo de investigación en el catálogo institucional */
export async function crearGrupo(datos: DatosGrupoInvestigacion) {
  const orden = await obtenerSiguienteOrden(prisma.grupoInvestigacion);
  return prisma.grupoInvestigacion.create({ data: { ...datos, orden } });
}

export async function listarGrupos(soloActivos?: boolean) {
  return prisma.grupoInvestigacion.findMany({
    where: soloActivos ? { activo: true } : undefined,
    include: { facultad: true, programa: true, tipoGrupo: true },
    orderBy: { orden: "asc" },
  });
}

/** Reordena los grupos de investigación según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarGrupos(ids: number[]) {
  return reordenarLista(prisma.grupoInvestigacion, "id_grupo", ids);
}

export async function obtenerGrupo(id_grupo: number) {
  const grupo = await prisma.grupoInvestigacion.findUnique({
    where: { id_grupo },
    include: { facultad: true, programa: true, tipoGrupo: true, dedicacion: true },
  });
  if (!grupo) throw new GrupoNoEncontradoError();
  return grupo;
}

/** Editar el nombre de un grupo de investigación del catálogo. Solo Administrador. */
export async function actualizarGrupo(id_grupo: number, nombre: string) {
  const existente = await prisma.grupoInvestigacion.findUnique({ where: { id_grupo } });
  if (!existente) throw new GrupoNoEncontradoError();

  return prisma.grupoInvestigacion.update({
    where: { id_grupo },
    data: { nombre },
    include: { facultad: true, programa: true, tipoGrupo: true },
  });
}

/**
 * Activar/desactivar un grupo de investigación. No se borra físicamente: hay
 * proyectos que ya lo referencian, un DELETE real los dejaría huérfanos.
 */
export async function cambiarEstadoGrupo(id_grupo: number, activo: boolean) {
  const existente = await prisma.grupoInvestigacion.findUnique({ where: { id_grupo } });
  if (!existente) throw new GrupoNoEncontradoError();

  return prisma.grupoInvestigacion.update({
    where: { id_grupo },
    data: { activo },
    include: { facultad: true, programa: true, tipoGrupo: true },
  });
}

/** Borrado real: solo si ningún proyecto ya usa este grupo. Si está en uso, hay que desactivarlo. */
export async function eliminarGrupo(id_grupo: number) {
  const existente = await prisma.grupoInvestigacion.findUnique({ where: { id_grupo } });
  if (!existente) throw new GrupoNoEncontradoError();

  const enUso = await prisma.proyectoGrupo.count({ where: { id_grupo } });
  if (enUso > 0) throw new GrupoEnUsoError();

  return prisma.grupoInvestigacion.delete({ where: { id_grupo } });
}
