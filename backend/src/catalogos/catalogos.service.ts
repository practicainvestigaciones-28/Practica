import { prisma } from "../config/prisma";

/**
 * Catálogos de apoyo: áreas de conocimiento, facultades, tipos de programa,
 * programas académicos, tipos de grupo, líneas de investigación, ODS y períodos.
 */

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
export async function listarProgramas() {
  return prisma.programa.findMany({
    include: { facultad: true, tipoPrograma: true },
    orderBy: { nombre: "asc" },
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
export async function listarLineasInvestigacion() {
  return prisma.lineaInvestigacion.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearOds(nombre: string, descripcion?: string) {
  return prisma.ods.create({ data: { nombre, descripcion } });
}
export async function listarOds() {
  return prisma.ods.findMany({ orderBy: { id_ods: "asc" } });
}

/* Modalidades de proyecto */
export async function crearModalidadProyecto(nombre: string, descripcion?: string) {
  return prisma.modalidadProyecto.create({ data: { nombre, descripcion } });
}
export async function listarModalidadesProyecto() {
  return prisma.modalidadProyecto.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearTipoProyecto(nombre: string) {
  return prisma.tipoProyecto.create({ data: { nombre } });
}
export async function listarTiposProyecto() {
  return prisma.tipoProyecto.findMany({ orderBy: { nombre: "asc" } });
}

/* Periodos */
export async function crearPeriodo(nombre: string) {
  return prisma.periodo.create({ data: { nombre } });
}
export async function listarPeriodos() {
  return prisma.periodo.findMany({ orderBy: { id_periodo: "asc" } });
}
