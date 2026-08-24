import { prisma } from "../config/prisma";

export class GrupoNoEncontradoError extends Error {
  constructor() {
    super("El grupo de investigación no existe");
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
  return prisma.grupoInvestigacion.create({ data: datos });
}

export async function listarGrupos() {
  return prisma.grupoInvestigacion.findMany({
    include: { facultad: true, programa: true, tipoGrupo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function obtenerGrupo(id_grupo: number) {
  const grupo = await prisma.grupoInvestigacion.findUnique({
    where: { id_grupo },
    include: { facultad: true, programa: true, tipoGrupo: true, dedicacion: true },
  });
  if (!grupo) throw new GrupoNoEncontradoError();
  return grupo;
}
