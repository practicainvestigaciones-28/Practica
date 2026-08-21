import { prisma } from "../config/prisma";
import { verificarPermisoProyecto } from "../utils/permisosProyecto";

export { ProyectoNoEncontradoError, NoAutorizadoProyectoError } from "../utils/permisosProyecto";

export class RegistroDuplicadoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

export class AsociacionNoEncontradaError extends Error {
  constructor() {
    super("Ese registro no existe para este proyecto");
  }
}

interface UsuarioQueEdita {
  id_usuario: number;
  roles: string[];
}

function esViolacionUnica(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

// ---------------------------------------------------------------------------
// RQF19 - Área de conocimiento del proyecto
// ---------------------------------------------------------------------------

export async function agregarArea(id_proyecto: number, id_area_conocimiento: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  try {
    return await prisma.proyectoArea.create({
      data: { id_proyectos: id_proyecto, id_area_conocimiento },
      include: { area: true },
    });
  } catch (error) {
    if (esViolacionUnica(error)) throw new RegistroDuplicadoError("Esa área de conocimiento ya está asociada al proyecto");
    throw error;
  }
}

export async function listarAreas(id_proyecto: number) {
  return prisma.proyectoArea.findMany({ where: { id_proyectos: id_proyecto }, include: { area: true } });
}

export async function quitarArea(id_proyecto: number, id_proyecto_area: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.proyectoArea.findUnique({ where: { id_proyecto_area } });
  if (!existente || existente.id_proyectos !== id_proyecto) throw new AsociacionNoEncontradaError();
  await prisma.proyectoArea.delete({ where: { id_proyecto_area } });
}

// ---------------------------------------------------------------------------
// RQF20 - Programas académicos del proyecto
// ---------------------------------------------------------------------------

export async function agregarPrograma(
  id_proyecto: number,
  datos: { id_programa?: number; programa_otro?: string },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  return prisma.proyectoPrograma.create({
    data: { id_proyectos: id_proyecto, id_programa: datos.id_programa, programa_otro: datos.programa_otro },
    include: { programa: true },
  });
}

export async function listarProgramas(id_proyecto: number) {
  return prisma.proyectoPrograma.findMany({ where: { id_proyectos: id_proyecto }, include: { programa: true } });
}

export async function quitarPrograma(id_proyecto: number, id_proyecto_programas: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.proyectoPrograma.findUnique({ where: { id_proyecto_programas } });
  if (!existente || existente.id_proyectos !== id_proyecto) throw new AsociacionNoEncontradaError();
  await prisma.proyectoPrograma.delete({ where: { id_proyecto_programas } });
}

// ---------------------------------------------------------------------------
// RQF22 - Financiación del proyecto (1 a 1)
// ---------------------------------------------------------------------------

export async function registrarFinanciacion(
  id_proyecto: number,
  datos: { valor_solicitado_unicesmag: number; valor_contrapartida?: number },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const valor_contrapartida = datos.valor_contrapartida ?? 0;
  const valor_total = datos.valor_solicitado_unicesmag + valor_contrapartida;

  return prisma.financiacion.upsert({
    where: { id_proyecto },
    update: { valor_solicitado_unicesmag: datos.valor_solicitado_unicesmag, valor_contrapartida, valor_total },
    create: {
      id_proyecto,
      valor_solicitado_unicesmag: datos.valor_solicitado_unicesmag,
      valor_contrapartida,
      valor_total,
    },
  });
}

export async function obtenerFinanciacion(id_proyecto: number) {
  return prisma.financiacion.findUnique({ where: { id_proyecto } });
}

// ---------------------------------------------------------------------------
// RQF23 / RQF25 - Grupos de investigación, línea y ODS del proyecto
// ---------------------------------------------------------------------------

export async function agregarGrupo(
  id_proyecto: number,
  datos: { id_grupo: number; id_linea_investigacion?: number; id_ods?: number },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  try {
    return await prisma.proyectoGrupo.create({
      data: { id_proyecto, ...datos },
      include: { grupo: true, lineaInvestigacion: true, ods: true },
    });
  } catch (error) {
    if (esViolacionUnica(error)) throw new RegistroDuplicadoError("Ese grupo de investigación ya está asociado al proyecto");
    throw error;
  }
}

export async function listarGruposDelProyecto(id_proyecto: number) {
  return prisma.proyectoGrupo.findMany({
    where: { id_proyecto },
    include: { grupo: true, lineaInvestigacion: true, ods: true },
  });
}

export async function quitarGrupo(id_proyecto: number, id_proyecto_grupo: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.proyectoGrupo.findUnique({ where: { id_proyecto_grupo } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new AsociacionNoEncontradaError();
  await prisma.proyectoGrupo.delete({ where: { id_proyecto_grupo } });
}
