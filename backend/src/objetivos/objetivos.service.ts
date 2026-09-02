import { prisma } from "../config/prisma";
import { verificarPermisoProyecto } from "../utils/permisosProyecto";
export { ProyectoNoEncontradoError, NoAutorizadoProyectoError } from "../utils/permisosProyecto";

export class TipoObjetivoInvalidoError extends Error {
  constructor() {
    super('tipo_objetivo debe ser "general" o "especifico"');
  }
}

export class ObjetivoNoEncontradoError extends Error {
  constructor() {
    super("El objetivo indicado no existe en este proyecto");
  }
}

export class AntecedenteNoEncontradoError extends Error {
  constructor() {
    super("El antecedente indicado no existe en este proyecto");
  }
}

export class ImpactoNoEncontradoError extends Error {
  constructor() {
    super("El impacto indicado no existe para ese objetivo");
  }
}

interface UsuarioQueEdita {
  id_usuario: number;
  roles: string[];
}

const TIPOS_OBJETIVO = ["general", "especifico"] as const;

// ---------------------------------------------------------------------------
// RQF27 - Objetivos
// ---------------------------------------------------------------------------

export async function agregarObjetivo(
  id_proyecto: number,
  datos: { tipo_objetivo: string; descripcion: string },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  if (!TIPOS_OBJETIVO.includes(datos.tipo_objetivo as (typeof TIPOS_OBJETIVO)[number])) {
    throw new TipoObjetivoInvalidoError();
  }

  return prisma.objetivo.create({ data: { id_proyecto, ...datos } });
}

export async function listarObjetivos(id_proyecto: number) {
  return prisma.objetivo.findMany({ where: { id_proyecto }, include: { impactos: true } });
}

export async function actualizarObjetivo(
  id_proyecto: number,
  id_objetivo: number,
  cambios: { tipo_objetivo?: string; descripcion?: string },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const existente = await prisma.objetivo.findUnique({ where: { id_objetivo } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new ObjetivoNoEncontradoError();

  if (cambios.tipo_objetivo && !TIPOS_OBJETIVO.includes(cambios.tipo_objetivo as (typeof TIPOS_OBJETIVO)[number])) {
    throw new TipoObjetivoInvalidoError();
  }

  return prisma.objetivo.update({ where: { id_objetivo }, data: cambios });
}

export async function quitarObjetivo(id_proyecto: number, id_objetivo: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.objetivo.findUnique({ where: { id_objetivo } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new ObjetivoNoEncontradoError();
  await prisma.objetivo.delete({ where: { id_objetivo } });
}

// ---------------------------------------------------------------------------
// RQF27 - Antecedentes
// ---------------------------------------------------------------------------

export async function agregarAntecedente(
  id_proyecto: number,
  datos: { descripcion: string; fecha_publicacion?: Date; autor?: string; fuente?: string },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  return prisma.antecedente.create({ data: { id_proyecto, ...datos } });
}

export async function listarAntecedentes(id_proyecto: number) {
  return prisma.antecedente.findMany({ where: { id_proyecto } });
}

export async function quitarAntecedente(id_proyecto: number, id_antecedente: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.antecedente.findUnique({ where: { id_antecedente } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new AntecedenteNoEncontradoError();
  await prisma.antecedente.delete({ where: { id_antecedente } });
}

// ---------------------------------------------------------------------------
// Referencias (Marco teórico)
// ---------------------------------------------------------------------------

export class ReferenciaNoEncontradaError extends Error {
  constructor() {
    super("La referencia indicada no existe en este proyecto");
  }
}

export async function agregarReferencia(
  id_proyecto: number,
  referencia: string,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  return prisma.referencia.create({ data: { id_proyecto, referencia } });
}

export async function listarReferencias(id_proyecto: number) {
  return prisma.referencia.findMany({ where: { id_proyecto } });
}

export async function quitarReferencia(id_proyecto: number, id_referencia: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.referencia.findUnique({ where: { id_referencia } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new ReferenciaNoEncontradaError();
  await prisma.referencia.delete({ where: { id_referencia } });
}

// ---------------------------------------------------------------------------
// RQF28 - Impactos asociados a objetivos específicos
// ---------------------------------------------------------------------------

export async function agregarImpacto(
  id_proyecto: number,
  id_objetivo: number,
  datos: { impacto_esperado: string; beneficiario_potencial?: string; indicador_verificable?: string },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const objetivo = await prisma.objetivo.findUnique({ where: { id_objetivo } });
  if (!objetivo || objetivo.id_proyecto !== id_proyecto) throw new ObjetivoNoEncontradoError();

  return prisma.impacto.create({ data: { id_objetivo, ...datos } });
}

export async function listarImpactos(id_proyecto: number, id_objetivo: number) {
  const objetivo = await prisma.objetivo.findUnique({ where: { id_objetivo } });
  if (!objetivo || objetivo.id_proyecto !== id_proyecto) throw new ObjetivoNoEncontradoError();

  return prisma.impacto.findMany({ where: { id_objetivo } });
}

export async function quitarImpacto(
  id_proyecto: number,
  id_objetivo: number,
  id_impacto: number,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const impacto = await prisma.impacto.findUnique({ where: { id_impacto } });
  if (!impacto || impacto.id_objetivo !== id_objetivo) throw new ImpactoNoEncontradoError();

  await prisma.impacto.delete({ where: { id_impacto } });
}