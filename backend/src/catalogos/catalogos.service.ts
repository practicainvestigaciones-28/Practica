import { prisma } from "../config/prisma";

/**
 * Catálogos de apoyo: áreas de conocimiento, facultades, tipos de programa,
 * programas académicos, tipos de grupo, líneas de investigación, ODS y períodos.
 */

export class ProgramaNoEncontradoError extends Error {
  constructor() {
    super("El programa académico indicado no existe");
  }
}

export class LineaInvestigacionNoEncontradaError extends Error {
  constructor() {
    super("La línea de investigación indicada no existe");
  }
}

export class ModalidadProyectoNoEncontradaError extends Error {
  constructor() {
    super("La modalidad de proyecto indicada no existe");
  }
}

export class TipoProyectoNoEncontradoError extends Error {
  constructor() {
    super("El tipo de proyecto indicado no existe");
  }
}

export class PeriodoNoEncontradoError extends Error {
  constructor() {
    super("El período indicado no existe");
  }
}

export class OdsNoEncontradoError extends Error {
  constructor() {
    super("El ODS indicado no existe");
  }
}

export async function crearAreaConocimiento(nombre: string, descripcion?: string) {
  return prisma.areaConocimiento.create({ data: { nombre, descripcion } });
}
export async function listarAreasConocimiento() {
  return prisma.areaConocimiento.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearFacultad(nombre: string) {
  return prisma.facultad.create({ data: { nombre } });
}
export async function listarFacultades() {
  return prisma.facultad.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearTipoPrograma(nombre: string) {
  return prisma.tipoPrograma.create({ data: { nombre } });
}
export async function listarTiposPrograma() {
  return prisma.tipoPrograma.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearPrograma(nombre: string, id_facultad: number, id_tipo_programa: number) {
  return prisma.programa.create({ data: { nombre, id_facultad, id_tipo_programa } });
}
export async function listarProgramas(soloActivos?: boolean) {
  return prisma.programa.findMany({
    where: soloActivos ? { activo: true } : undefined,
    include: { facultad: true, tipoPrograma: true },
    orderBy: { nombre: "asc" },
  });
}

/** Editar el nombre de un programa académico existente. Solo Administrador. */
export async function actualizarPrograma(id_programa: number, nombre: string) {
  const existente = await prisma.programa.findUnique({ where: { id_programa } });
  if (!existente) throw new ProgramaNoEncontradoError();

  return prisma.programa.update({
    where: { id_programa },
    data: { nombre },
    include: { facultad: true, tipoPrograma: true },
  });
}

/**
 * Activar/desactivar un programa académico. No se borra físicamente: hay
 * proyectos y grupos de investigación que ya lo referencian, un DELETE real
 * los dejaría huérfanos.
 */
export async function cambiarEstadoPrograma(id_programa: number, activo: boolean) {
  const existente = await prisma.programa.findUnique({ where: { id_programa } });
  if (!existente) throw new ProgramaNoEncontradoError();

  return prisma.programa.update({
    where: { id_programa },
    data: { activo },
    include: { facultad: true, tipoPrograma: true },
  });
}

export async function crearTipoGrupo(nombre: string) {
  return prisma.tipoGrupo.create({ data: { nombre } });
}
export async function listarTiposGrupo() {
  return prisma.tipoGrupo.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearLineaInvestigacion(nombre: string, descripcion?: string) {
  return prisma.lineaInvestigacion.create({ data: { nombre, descripcion } });
}
export async function listarLineasInvestigacion(soloActivos?: boolean) {
  return prisma.lineaInvestigacion.findMany({
    where: soloActivos ? { activa: true } : undefined,
    orderBy: { nombre: "asc" },
  });
}

/** Editar el nombre de una línea de investigación existente. Solo Administrador. */
export async function actualizarLineaInvestigacion(id_linea: number, nombre: string) {
  const existente = await prisma.lineaInvestigacion.findUnique({ where: { id_linea } });
  if (!existente) throw new LineaInvestigacionNoEncontradaError();

  return prisma.lineaInvestigacion.update({ where: { id_linea }, data: { nombre } });
}

/**
 * Activar/desactivar una línea de investigación. No se borra físicamente:
 * hay grupos y proyectos que ya la referencian.
 */
export async function cambiarEstadoLineaInvestigacion(id_linea: number, activa: boolean) {
  const existente = await prisma.lineaInvestigacion.findUnique({ where: { id_linea } });
  if (!existente) throw new LineaInvestigacionNoEncontradaError();

  return prisma.lineaInvestigacion.update({ where: { id_linea }, data: { activa } });
}

export async function crearOds(nombre: string, descripcion?: string) {
  return prisma.ods.create({ data: { nombre, descripcion } });
}
export async function listarOds(soloActivos?: boolean) {
  return prisma.ods.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { id_ods: "asc" },
  });
}

/** Editar el nombre de un ODS existente. Solo Administrador. */
export async function actualizarOds(id_ods: number, nombre: string) {
  const existente = await prisma.ods.findUnique({ where: { id_ods } });
  if (!existente) throw new OdsNoEncontradoError();

  return prisma.ods.update({ where: { id_ods }, data: { nombre } });
}

/** Activar/desactivar un ODS. No se borra físicamente: hay proyectos que ya lo referencian. */
export async function cambiarEstadoOds(id_ods: number, activo: boolean) {
  const existente = await prisma.ods.findUnique({ where: { id_ods } });
  if (!existente) throw new OdsNoEncontradoError();

  return prisma.ods.update({ where: { id_ods }, data: { activo } });
}

/* Modalidades de proyecto */
export async function crearModalidadProyecto(nombre: string, descripcion?: string) {
  return prisma.modalidadProyecto.create({ data: { nombre, descripcion } });
}
export async function listarModalidadesProyecto(soloActivos?: boolean) {
  return prisma.modalidadProyecto.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { nombre: "asc" },
  });
}

/** Editar el nombre de una modalidad de proyecto existente. Solo Administrador. */
export async function actualizarModalidadProyecto(id_modalidad: number, nombre: string) {
  const existente = await prisma.modalidadProyecto.findUnique({ where: { id_modalidad } });
  if (!existente) throw new ModalidadProyectoNoEncontradaError();

  return prisma.modalidadProyecto.update({ where: { id_modalidad }, data: { nombre } });
}

/** Activar/desactivar una modalidad de proyecto. No se borra: hay proyectos que ya la referencian. */
export async function cambiarEstadoModalidadProyecto(id_modalidad: number, activo: boolean) {
  const existente = await prisma.modalidadProyecto.findUnique({ where: { id_modalidad } });
  if (!existente) throw new ModalidadProyectoNoEncontradaError();

  return prisma.modalidadProyecto.update({ where: { id_modalidad }, data: { activo } });
}

export async function crearTipoProyecto(nombre: string) {
  return prisma.tipoProyecto.create({ data: { nombre } });
}

/** Editar el nombre de un tipo de proyecto existente. Solo Administrador. */
export async function actualizarTipoProyecto(id_tipo_proyecto: number, nombre: string) {
  const existente = await prisma.tipoProyecto.findUnique({ where: { id_tipo_proyecto } });
  if (!existente) throw new TipoProyectoNoEncontradoError();

  return prisma.tipoProyecto.update({ where: { id_tipo_proyecto }, data: { nombre } });
}

/** Activar/desactivar un tipo de proyecto. No se borra: hay proyectos que ya lo referencian. */
export async function cambiarEstadoTipoProyecto(id_tipo_proyecto: number, activo: boolean) {
  const existente = await prisma.tipoProyecto.findUnique({ where: { id_tipo_proyecto } });
  if (!existente) throw new TipoProyectoNoEncontradoError();

  return prisma.tipoProyecto.update({ where: { id_tipo_proyecto }, data: { activo } });
}
export async function listarTiposProyecto(soloActivos?: boolean) {
  return prisma.tipoProyecto.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { nombre: "asc" },
  });
}

/* Periodos */
export async function crearPeriodo(nombre: string) {
  return prisma.periodo.create({ data: { nombre } });
}
export async function listarPeriodos(soloActivos?: boolean) {
  return prisma.periodo.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { id_periodo: "asc" },
  });
}

/** Editar el nombre de un período existente. Solo Administrador. */
export async function actualizarPeriodo(id_periodo: number, nombre: string) {
  const existente = await prisma.periodo.findUnique({ where: { id_periodo } });
  if (!existente) throw new PeriodoNoEncontradoError();

  return prisma.periodo.update({ where: { id_periodo }, data: { nombre } });
}

/** Activar/desactivar un período. No se borra: hay cronogramas que ya lo referencian. */
export async function cambiarEstadoPeriodo(id_periodo: number, activo: boolean) {
  const existente = await prisma.periodo.findUnique({ where: { id_periodo } });
  if (!existente) throw new PeriodoNoEncontradoError();

  return prisma.periodo.update({ where: { id_periodo }, data: { activo } });
}
export async function listarDedicaciones() {
  return prisma.dedicacion.findMany({ orderBy: { id_dedicacion: "asc" } });
}

export async function listarRolesProyecto() {
  return prisma.rolProyecto.findMany({ orderBy: { id_rol_pro: "asc" } });
}

export async function listarRolesEstudiante() {
  return prisma.rolEstudiante.findMany({ orderBy: { id_rolestudiante: "asc" } });
}