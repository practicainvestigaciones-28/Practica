import { prisma } from "../config/prisma";
import { obtenerSiguienteOrden, reordenarLista } from "../utils/ordenManual";
export { OrdenInvalidoError } from "../utils/ordenManual";

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

export class AreaConocimientoNoEncontradaError extends Error {
  constructor() {
    super("El área de conocimiento indicada no existe");
  }
}

export class FacultadNoEncontradaError extends Error {
  constructor() {
    super("La facultad indicada no existe");
  }
}

/**
 * Se lanza al intentar borrar físicamente un catálogo que ya está
 * referenciado por al menos un proyecto (o grupo/cronograma, según el
 * catálogo). El botón "Eliminar" del frontend solo debe permitir el
 * borrado real cuando nada lo está usando; si ya está en uso, la
 * alternativa es desactivarlo con cambiarEstadoX.
 */
export class ProgramaEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay proyectos o grupos de investigación que ya usan este programa");
  }
}

export class LineaInvestigacionEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay proyectos que ya usan esta línea de investigación");
  }
}

export class ModalidadProyectoEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay proyectos que ya usan esta modalidad");
  }
}

export class TipoProyectoEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay proyectos que ya usan este tipo de proyecto");
  }
}

export class OdsEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay proyectos que ya usan este ODS");
  }
}

export class AreaConocimientoEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay proyectos que ya usan esta área de conocimiento");
  }
}

export class PeriodoEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay cronogramas que ya usan este período");
  }
}

export class FacultadEnUsoError extends Error {
  constructor() {
    super("No se puede eliminar: hay programas o grupos de investigación que ya usan esta facultad");
  }
}

export async function crearAreaConocimiento(nombre: string, descripcion?: string) {
  const orden = await obtenerSiguienteOrden(prisma.areaConocimiento);
  return prisma.areaConocimiento.create({ data: { nombre, descripcion, orden } });
}
export async function listarAreasConocimiento(soloActivos?: boolean) {
  return prisma.areaConocimiento.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { orden: "asc" },
  });
}

/** Reordena las áreas de conocimiento según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarAreasConocimiento(ids: number[]) {
  return reordenarLista(prisma.areaConocimiento, "id_area_conocimiento", ids);
}

/** Editar nombre/descripción de un área de conocimiento existente. Solo Administrador. */
export async function actualizarAreaConocimiento(id_area_conocimiento: number, nombre: string, descripcion?: string) {
  const existente = await prisma.areaConocimiento.findUnique({ where: { id_area_conocimiento } });
  if (!existente) throw new AreaConocimientoNoEncontradaError();

  return prisma.areaConocimiento.update({ where: { id_area_conocimiento }, data: { nombre, descripcion } });
}

/** Activar/desactivar un área de conocimiento. No se borra: hay proyectos que ya la referencian. */
export async function cambiarEstadoAreaConocimiento(id_area_conocimiento: number, activo: boolean) {
  const existente = await prisma.areaConocimiento.findUnique({ where: { id_area_conocimiento } });
  if (!existente) throw new AreaConocimientoNoEncontradaError();

  return prisma.areaConocimiento.update({ where: { id_area_conocimiento }, data: { activo } });
}

/** Borrado real: solo si ningún proyecto ya usa esta área. Si está en uso, hay que desactivarla en su lugar. */
export async function eliminarAreaConocimiento(id_area_conocimiento: number) {
  const existente = await prisma.areaConocimiento.findUnique({ where: { id_area_conocimiento } });
  if (!existente) throw new AreaConocimientoNoEncontradaError();

  const enUso = await prisma.proyectoArea.count({ where: { id_area_conocimiento } });
  if (enUso > 0) throw new AreaConocimientoEnUsoError();

  return prisma.areaConocimiento.delete({ where: { id_area_conocimiento } });
}

export async function crearFacultad(nombre: string) {
  const orden = await obtenerSiguienteOrden(prisma.facultad);
  return prisma.facultad.create({ data: { nombre, orden } });
}
export async function listarFacultades(soloActivos?: boolean) {
  return prisma.facultad.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { orden: "asc" },
  });
}

/** Reordena las facultades según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarFacultades(ids: number[]) {
  return reordenarLista(prisma.facultad, "id_facultad", ids);
}

/** Editar el nombre de una facultad existente. Solo Administrador. */
export async function actualizarFacultad(id_facultad: number, nombre: string) {
  const existente = await prisma.facultad.findUnique({ where: { id_facultad } });
  if (!existente) throw new FacultadNoEncontradaError();

  return prisma.facultad.update({ where: { id_facultad }, data: { nombre } });
}

/**
 * Activar/desactivar una facultad. No se borra físicamente: hay programas y
 * grupos de investigación que ya la referencian, un DELETE real los dejaría
 * huérfanos.
 */
export async function cambiarEstadoFacultad(id_facultad: number, activo: boolean) {
  const existente = await prisma.facultad.findUnique({ where: { id_facultad } });
  if (!existente) throw new FacultadNoEncontradaError();

  return prisma.facultad.update({ where: { id_facultad }, data: { activo } });
}

/** Borrado real: solo si ningún programa o grupo ya usa esta facultad. Si está en uso, hay que desactivarla. */
export async function eliminarFacultad(id_facultad: number) {
  const existente = await prisma.facultad.findUnique({ where: { id_facultad } });
  if (!existente) throw new FacultadNoEncontradaError();

  const [enProgramas, enGrupos] = await Promise.all([
    prisma.programa.count({ where: { id_facultad } }),
    prisma.grupoInvestigacion.count({ where: { id_facultad } }),
  ]);
  if (enProgramas > 0 || enGrupos > 0) throw new FacultadEnUsoError();

  return prisma.facultad.delete({ where: { id_facultad } });
}

export async function crearTipoPrograma(nombre: string) {
  return prisma.tipoPrograma.create({ data: { nombre } });
}
export async function listarTiposPrograma() {
  return prisma.tipoPrograma.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearPrograma(nombre: string, id_facultad: number, id_tipo_programa: number) {
  // El orden se lleva por tipo de programa (pregrado/posgrado), que es como se agrupan en la pestaña.
  const orden = await obtenerSiguienteOrden(prisma.programa, { id_tipo_programa });
  return prisma.programa.create({ data: { nombre, id_facultad, id_tipo_programa, orden } });
}
export async function listarProgramas(soloActivos?: boolean) {
  return prisma.programa.findMany({
    where: soloActivos ? { activo: true } : undefined,
    include: { facultad: true, tipoPrograma: true },
    orderBy: { orden: "asc" },
  });
}

/** Reordena los programas académicos de un mismo tipo (pregrado/posgrado) según el arreglo de ids recibido. */
export async function reordenarProgramas(id_tipo_programa: number, ids: number[]) {
  return reordenarLista(prisma.programa, "id_programa", ids, { id_tipo_programa });
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

/** Borrado real: solo si ningún proyecto o grupo ya usa este programa. Si está en uso, hay que desactivarlo. */
export async function eliminarPrograma(id_programa: number) {
  const existente = await prisma.programa.findUnique({ where: { id_programa } });
  if (!existente) throw new ProgramaNoEncontradoError();

  const [enProyectos, enGrupos] = await Promise.all([
    prisma.proyectoPrograma.count({ where: { id_programa } }),
    prisma.grupoInvestigacion.count({ where: { id_programa } }),
  ]);
  if (enProyectos > 0 || enGrupos > 0) throw new ProgramaEnUsoError();

  return prisma.programa.delete({ where: { id_programa } });
}

export async function crearTipoGrupo(nombre: string) {
  return prisma.tipoGrupo.create({ data: { nombre } });
}
export async function listarTiposGrupo() {
  return prisma.tipoGrupo.findMany({ orderBy: { nombre: "asc" } });
}

export async function crearLineaInvestigacion(nombre: string, id_grupo?: number, descripcion?: string) {
  const orden = await obtenerSiguienteOrden(prisma.lineaInvestigacion);
  return prisma.lineaInvestigacion.create({
    data: { nombre, descripcion, id_grupo, orden },
    include: { grupo: { include: { facultad: true, programa: true } } },
  });
}
export async function listarLineasInvestigacion(soloActivos?: boolean) {
  return prisma.lineaInvestigacion.findMany({
    where: soloActivos ? { activa: true } : undefined,
    include: { grupo: { include: { facultad: true, programa: true } } },
    orderBy: { orden: "asc" },
  });
}

/** Reordena las líneas de investigación según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarLineasInvestigacion(ids: number[]) {
  return reordenarLista(prisma.lineaInvestigacion, "id_linea", ids);
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

/** Borrado real: solo si ningún proyecto ya usa esta línea. Si está en uso, hay que desactivarla en su lugar. */
export async function eliminarLineaInvestigacion(id_linea: number) {
  const existente = await prisma.lineaInvestigacion.findUnique({ where: { id_linea } });
  if (!existente) throw new LineaInvestigacionNoEncontradaError();

  const enUso = await prisma.proyectoGrupo.count({ where: { id_linea_investigacion: id_linea } });
  if (enUso > 0) throw new LineaInvestigacionEnUsoError();

  return prisma.lineaInvestigacion.delete({ where: { id_linea } });
}

export async function crearOds(nombre: string, descripcion?: string) {
  const orden = await obtenerSiguienteOrden(prisma.ods);
  return prisma.ods.create({ data: { nombre, descripcion, orden } });
}
export async function listarOds(soloActivos?: boolean) {
  return prisma.ods.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { orden: "asc" },
  });
}

/** Reordena los ODS según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarOds(ids: number[]) {
  return reordenarLista(prisma.ods, "id_ods", ids);
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

/** Borrado real: solo si ningún proyecto ya usa este ODS. Si está en uso, hay que desactivarlo en su lugar. */
export async function eliminarOds(id_ods: number) {
  const existente = await prisma.ods.findUnique({ where: { id_ods } });
  if (!existente) throw new OdsNoEncontradoError();

  const enUso = await prisma.proyectoGrupoOds.count({ where: { id_ods } });
  if (enUso > 0) throw new OdsEnUsoError();

  return prisma.ods.delete({ where: { id_ods } });
}

/* Modalidades de proyecto */
export async function crearModalidadProyecto(nombre: string, descripcion?: string) {
  const orden = await obtenerSiguienteOrden(prisma.modalidadProyecto);
  return prisma.modalidadProyecto.create({ data: { nombre, descripcion, orden } });
}
export async function listarModalidadesProyecto(soloActivos?: boolean) {
  return prisma.modalidadProyecto.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { orden: "asc" },
  });
}

/** Reordena las modalidades de proyecto según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarModalidadesProyecto(ids: number[]) {
  return reordenarLista(prisma.modalidadProyecto, "id_modalidad", ids);
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

/** Borrado real: solo si ningún proyecto ya usa esta modalidad. Si está en uso, hay que desactivarla en su lugar. */
export async function eliminarModalidadProyecto(id_modalidad: number) {
  const existente = await prisma.modalidadProyecto.findUnique({ where: { id_modalidad } });
  if (!existente) throw new ModalidadProyectoNoEncontradaError();

  const enUso = await prisma.proyecto.count({ where: { id_modalidad_proyecto: id_modalidad } });
  if (enUso > 0) throw new ModalidadProyectoEnUsoError();

  return prisma.modalidadProyecto.delete({ where: { id_modalidad } });
}

export async function crearTipoProyecto(nombre: string) {
  const orden = await obtenerSiguienteOrden(prisma.tipoProyecto);
  return prisma.tipoProyecto.create({ data: { nombre, orden } });
}

/** Reordena los tipos de proyecto según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarTiposProyecto(ids: number[]) {
  return reordenarLista(prisma.tipoProyecto, "id_tipo_proyecto", ids);
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

/** Borrado real: solo si ningún proyecto ya usa este tipo. Si está en uso, hay que desactivarlo en su lugar. */
export async function eliminarTipoProyecto(id_tipo_proyecto: number) {
  const existente = await prisma.tipoProyecto.findUnique({ where: { id_tipo_proyecto } });
  if (!existente) throw new TipoProyectoNoEncontradoError();

  const enUso = await prisma.proyecto.count({ where: { id_tipo_proyecto } });
  if (enUso > 0) throw new TipoProyectoEnUsoError();

  return prisma.tipoProyecto.delete({ where: { id_tipo_proyecto } });
}
export async function listarTiposProyecto(soloActivos?: boolean) {
  return prisma.tipoProyecto.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { orden: "asc" },
  });
}

/** Catálogo "Tipo de articulación" (Interinstitucional/Intergrupal/...) — vista de seguimiento del líder. */
export async function listarTiposArticulacion(soloActivos?: boolean) {
  return prisma.tipoArticulacion.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { nombre: "asc" },
  });
}

/* Periodos */
export async function crearPeriodo(nombre: string) {
  const orden = await obtenerSiguienteOrden(prisma.periodo);
  return prisma.periodo.create({ data: { nombre, orden } });
}
export async function listarPeriodos(soloActivos?: boolean) {
  return prisma.periodo.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { orden: "asc" },
  });
}

/** Reordena los períodos según el arreglo de ids recibido (arrastrar y soltar). */
export async function reordenarPeriodos(ids: number[]) {
  return reordenarLista(prisma.periodo, "id_periodo", ids);
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

/** Borrado real: solo si ningún cronograma ya usa este período. Si está en uso, hay que desactivarlo en su lugar. */
export async function eliminarPeriodo(id_periodo: number) {
  const existente = await prisma.periodo.findUnique({ where: { id_periodo } });
  if (!existente) throw new PeriodoNoEncontradoError();

  const enUso = await prisma.cronogramaPeriodoMes.count({ where: { id_periodo } });
  if (enUso > 0) throw new PeriodoEnUsoError();

  return prisma.periodo.delete({ where: { id_periodo } });
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