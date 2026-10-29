import { prisma } from "../config/prisma";
import { verificarPermisoProyecto } from "../utils/permisosProyecto";

const INCLUDE_GRUPO_PROYECTO = {
  grupo: true,
  lineas: { include: { lineaInvestigacion: true } },
  odsVarios: { include: { ods: true } },
  investigadores: { orderBy: { orden: "asc" as const } },
};

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
  datos: { id_grupo: number; orden?: number },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  try {
    return await prisma.proyectoGrupo.create({
      data: { id_proyecto, ...datos },
      include: INCLUDE_GRUPO_PROYECTO,
    });
  } catch (error) {
    if (esViolacionUnica(error)) throw new RegistroDuplicadoError("Ese grupo de investigación ya está asociado al proyecto");
    throw error;
  }
}

export async function listarGruposDelProyecto(id_proyecto: number) {
  return prisma.proyectoGrupo.findMany({
    where: { id_proyecto },
    include: INCLUDE_GRUPO_PROYECTO,
    orderBy: [{ orden: "asc" }, { id_proyecto_grupo: "asc" }],
  });
}

/** "Investigadores del proyecto" de un grupo (pestaña Grupos): texto libre con horas, no es un participante. */
export async function agregarInvestigadorGrupo(
  id_proyecto: number,
  id_proyecto_grupo: number,
  datos: { nombre_completo: string; horas_semanales?: number | null },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const grupo = await prisma.proyectoGrupo.findUnique({ where: { id_proyecto_grupo } });
  if (!grupo || grupo.id_proyecto !== id_proyecto) throw new AsociacionNoEncontradaError();
  const orden = await prisma.proyectoGrupoInvestigador.count({ where: { id_proyecto_grupo } });
  return prisma.proyectoGrupoInvestigador.create({
    data: {
      id_proyecto_grupo,
      nombre_completo: datos.nombre_completo.trim(),
      horas_semanales: datos.horas_semanales ?? null,
      orden,
    },
  });
}

export async function quitarGrupo(id_proyecto: number, id_proyecto_grupo: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.proyectoGrupo.findUnique({ where: { id_proyecto_grupo } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new AsociacionNoEncontradaError();
  await prisma.proyectoGrupo.delete({ where: { id_proyecto_grupo } });
}

/** Un grupo del proyecto puede asociarse a más de un ODS (ver ProyectoGrupoOds). */
export async function agregarOdsGrupo(
  id_proyecto: number,
  id_proyecto_grupo: number,
  id_ods: number,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const grupo = await prisma.proyectoGrupo.findUnique({ where: { id_proyecto_grupo } });
  if (!grupo || grupo.id_proyecto !== id_proyecto) throw new AsociacionNoEncontradaError();
  try {
    return await prisma.proyectoGrupoOds.create({
      data: { id_proyecto_grupo, id_ods },
      include: { ods: true },
    });
  } catch (error) {
    if (esViolacionUnica(error)) throw new RegistroDuplicadoError("Ese ODS ya está asociado a este grupo");
    throw error;
  }
}

export async function quitarOdsGrupo(
  id_proyecto: number,
  id_proyecto_grupo: number,
  id_proyecto_grupo_ods: number,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const grupo = await prisma.proyectoGrupo.findUnique({ where: { id_proyecto_grupo } });
  if (!grupo || grupo.id_proyecto !== id_proyecto) throw new AsociacionNoEncontradaError();
  const existente = await prisma.proyectoGrupoOds.findUnique({ where: { id_proyecto_grupo_ods } });
  if (!existente || existente.id_proyecto_grupo !== id_proyecto_grupo) throw new AsociacionNoEncontradaError();
  await prisma.proyectoGrupoOds.delete({ where: { id_proyecto_grupo_ods } });
}

/**
 * Un grupo UNICESMAG (interno) del proyecto puede estar vinculado a más de
 * una línea de investigación del catálogo real (ver ProyectoGrupoLinea) —
 * los grupos externos no usan esto, van por texto libre en
 * GrupoInvestigacion.lineas_externas (no tenemos su catálogo institucional).
 */
export async function agregarLineaGrupo(
  id_proyecto: number,
  id_proyecto_grupo: number,
  id_linea_investigacion: number,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const grupo = await prisma.proyectoGrupo.findUnique({ where: { id_proyecto_grupo } });
  if (!grupo || grupo.id_proyecto !== id_proyecto) throw new AsociacionNoEncontradaError();
  try {
    return await prisma.proyectoGrupoLinea.create({
      data: { id_proyecto_grupo, id_linea_investigacion },
      include: { lineaInvestigacion: true },
    });
  } catch (error) {
    if (esViolacionUnica(error)) throw new RegistroDuplicadoError("Esa línea de investigación ya está asociada a este grupo");
    throw error;
  }
}

export async function quitarLineaGrupo(
  id_proyecto: number,
  id_proyecto_grupo: number,
  id_proyecto_grupo_linea: number,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const grupo = await prisma.proyectoGrupo.findUnique({ where: { id_proyecto_grupo } });
  if (!grupo || grupo.id_proyecto !== id_proyecto) throw new AsociacionNoEncontradaError();
  const existente = await prisma.proyectoGrupoLinea.findUnique({ where: { id_proyecto_grupo_linea } });
  if (!existente || existente.id_proyecto_grupo !== id_proyecto_grupo) throw new AsociacionNoEncontradaError();
  await prisma.proyectoGrupoLinea.delete({ where: { id_proyecto_grupo_linea } });
}

export interface DatosEgresadosInfo {
  id_facultad: number | null;
  id_programa: number | null;
  empresa_entidad: string | null;
  integrantes: { nombre_completo: string; horas_semanales: number | null }[];
}

/** "Información general de egresados" del proyecto (pestaña Grupos), o null si no se ha diligenciado. */
export async function obtenerEgresadosInfo(id_proyecto: number) {
  return prisma.proyectoEgresadosInfo.findUnique({
    where: { id_proyecto },
    include: { integrantes: { orderBy: { orden: "asc" } } },
  });
}

/** Reemplaza la sección completa (datos + integrantes) por lo que trae el formulario. */
export async function guardarEgresadosInfo(id_proyecto: number, datos: DatosEgresadosInfo, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const integrantes = datos.integrantes
    .filter((i) => i.nombre_completo.trim())
    .map((i, orden) => ({ nombre_completo: i.nombre_completo.trim(), horas_semanales: i.horas_semanales, orden }));
  const vacia = !datos.id_facultad && !datos.id_programa && !datos.empresa_entidad?.trim() && integrantes.length === 0;

  return prisma.$transaction(async (tx) => {
    await tx.proyectoEgresadosInfo.deleteMany({ where: { id_proyecto } });
    if (vacia) return null;
    return tx.proyectoEgresadosInfo.create({
      data: {
        id_proyecto,
        id_facultad: datos.id_facultad,
        id_programa: datos.id_programa,
        empresa_entidad: datos.empresa_entidad?.trim() || null,
        integrantes: { create: integrantes },
      },
      include: { integrantes: { orderBy: { orden: "asc" } } },
    });
  });
}

const ROLES_HOJA_VIDA = ["coinvestigador", "externo"] as const;
/** Campos de la ficha de hoja de vida que se guardan (mismos nombres que HojaVida del usuario). */
export const CAMPOS_HOJA_VIDA_PROYECTO = [
  "nombres",
  "apellidos",
  "correo",
  "correo_personal",
  "lugar_nacimiento",
  "fecha_nacimiento",
  "nacionalidad",
  "tipo_documento",
  "numero_documento",
  "direccion",
  "telefono",
  "celular",
  "orcid",
  "google_academico",
  "categoria_minciencias",
  "cargo_actual",
  "cargos_desempenados",
  "titulos_academicos",
  "produccion_cientifica",
] as const;

export class HojaVidaInvalidaError extends Error {}

export async function listarHojasVidaProyecto(id_proyecto: number) {
  return prisma.proyectoHojaVida.findMany({ where: { id_proyecto }, orderBy: [{ rol: "asc" }, { orden: "asc" }] });
}

/** Reemplaza todas las fichas de co-investigadores del proyecto por las del formulario. */
export async function guardarHojasVidaProyecto(
  id_proyecto: number,
  hojas: { rol: string; datos: Record<string, unknown> }[],
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const ordenPorRol: Record<string, number> = {};
  const filas = hojas.map((h) => {
    if (!(ROLES_HOJA_VIDA as readonly string[]).includes(h.rol)) throw new HojaVidaInvalidaError(`Rol de hoja de vida inválido: ${h.rol}`);
    const datos: Record<string, string> = {};
    for (const campo of CAMPOS_HOJA_VIDA_PROYECTO) {
      const valor = h.datos?.[campo];
      if (typeof valor === "string" && valor.trim()) datos[campo] = valor.trim().slice(0, 10000);
    }
    const orden = ordenPorRol[h.rol] ?? 0;
    ordenPorRol[h.rol] = orden + 1;
    return { id_proyecto, rol: h.rol, orden, datos };
  });
  return prisma.$transaction(async (tx) => {
    await tx.proyectoHojaVida.deleteMany({ where: { id_proyecto } });
    if (filas.length > 0) await tx.proyectoHojaVida.createMany({ data: filas });
    return tx.proyectoHojaVida.findMany({ where: { id_proyecto }, orderBy: [{ rol: "asc" }, { orden: "asc" }] });
  });
}
