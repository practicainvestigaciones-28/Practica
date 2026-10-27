import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";

/**
 * Etapa de seguimiento/ejecución (posterior al Acta de Inicio legalizada):
 * catálogos, lectura del proyecto ensamblado completo, e informes de avance
 * (M-03), novedades (M-05), informe técnico final (M-06) y acta de cierre
 * (M-07), cada uno con su propia máquina de estados y reglas de firmas
 * secuenciales (ver los helpers compartidos de la sección "Firmas
 * secuenciales").
 *
 * El contrato (formas de datos, reglas) replica exactamente lo que ya
 * esperaba el frontend (ver `frontend/src/modules/seguimiento/api/
 * seguimiento.ts` y `lib/reglas.ts`), que hasta ahora corría sobre
 * localStorage — este servicio es su reemplazo real.
 */

export class ProyectoSeguimientoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no está en etapa de seguimiento.");
  }
}

export class NoParticipaEnProyectoError extends Error {
  constructor() {
    super("No participas en este proyecto.");
  }
}

/** Mismo propósito que `exigir()`/`ApiError(422,...)` del frontend: una regla de negocio no se cumplió. */
export class ValidacionSeguimientoError extends Error {
  detalle?: string[];
  constructor(mensaje: string, detalle?: string[]) {
    super(mensaje);
    this.detalle = detalle;
  }
}

function exigir(condicion: unknown, mensaje: string, detalle?: string[]): asserts condicion {
  if (!condicion) throw new ValidacionSeguimientoError(mensaje, detalle);
}

interface UsuarioQueConsulta {
  id_usuario: number;
  roles: string[];
}

const ROL_PRINCIPAL = "Investigador(a) Principal UNICESMAG";
const ROL_COINVESTIGADOR_INTERNO = "Co investigador(a) UNICESMAG";
const ROL_COINVESTIGADOR_EXTERNO = "Co investigador(a) Externo(a)";
const ROL_ESTUDIANTE = "Estudiante Investigador(a)";

const MESES_POR_PERIODO = 6;
const SEMANAS_POR_PERIODO = 24;

function esAdministradorOVicerrector(usuario: UsuarioQueConsulta): boolean {
  return usuario.roles.includes("Administrador") || usuario.roles.includes("Vicerrector");
}

// ---------------------------------------------------------------------------
// Catálogos: Tipos de novedad / Tipos de articulación
// ---------------------------------------------------------------------------

export async function listarTiposNovedad() {
  return prisma.tipoNovedad.findMany({ orderBy: { nombre: "asc" } });
}

export interface DatosTipoNovedad {
  id?: number;
  nombre: string;
  descripcion?: string;
  afecta_fechas?: boolean;
  afecta_participantes?: boolean;
  afecta_productos?: boolean;
  activo?: boolean;
}

export class NombreDuplicadoError extends Error {
  constructor(nombre: string) {
    super(`Ya existe un registro llamado "${nombre}".`);
  }
}

export class NombreRequeridoError extends Error {
  constructor() {
    super("El nombre es obligatorio.");
  }
}

export async function guardarTipoNovedad(datos: DatosTipoNovedad) {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new NombreRequeridoError();
  const existente = await prisma.tipoNovedad.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, ...(datos.id ? { id_tipo_novedad: { not: datos.id } } : {}) },
  });
  if (existente) throw new NombreDuplicadoError(nombre);

  const data = {
    nombre,
    descripcion: datos.descripcion ?? "",
    afecta_fechas: datos.afecta_fechas ?? false,
    afecta_participantes: datos.afecta_participantes ?? false,
    afecta_productos: datos.afecta_productos ?? false,
    activo: datos.activo ?? true,
  };
  if (datos.id) {
    await prisma.tipoNovedad.update({ where: { id_tipo_novedad: datos.id }, data });
  } else {
    await prisma.tipoNovedad.create({ data });
  }
  return listarTiposNovedad();
}

export async function eliminarTipoNovedad(id: number) {
  await prisma.tipoNovedad.delete({ where: { id_tipo_novedad: id } }).catch(() => null);
  return listarTiposNovedad();
}

export async function listarTiposArticulacion() {
  return prisma.tipoArticulacion.findMany({ orderBy: { nombre: "asc" } });
}

export interface DatosTipoArticulacion {
  id?: number;
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

export async function guardarTipoArticulacion(datos: DatosTipoArticulacion) {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new NombreRequeridoError();
  const existente = await prisma.tipoArticulacion.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, ...(datos.id ? { id_tipo_articulacion: { not: datos.id } } : {}) },
  });
  if (existente) throw new NombreDuplicadoError(nombre);

  const data = { nombre, descripcion: datos.descripcion ?? "", activo: datos.activo ?? true };
  if (datos.id) {
    await prisma.tipoArticulacion.update({ where: { id_tipo_articulacion: datos.id }, data });
  } else {
    await prisma.tipoArticulacion.create({ data });
  }
  return listarTiposArticulacion();
}

export async function eliminarTipoArticulacion(id: number) {
  await prisma.tipoArticulacion.delete({ where: { id_tipo_articulacion: id } }).catch(() => null);
  return listarTiposArticulacion();
}

// ---------------------------------------------------------------------------
// Ensamblado del proyecto completo (lectura)
// ---------------------------------------------------------------------------

const INCLUDE_PROYECTO_SEGUIMIENTO = {
  convocatoria: { select: { nombre: true } },
  modalidad: { select: { nombre: true } },
  tipoArticulacion: { select: { nombre: true } },
  actasInicio: { where: { estado: "legalizada" }, take: 1 },
  financiacion: { include: { vigencias: { orderBy: { anio: "asc" as const } } } },
  grupos: { include: { grupo: { select: { nombre: true } } }, take: 1 },
  participantes: {
    include: {
      usuario: { select: { id_usuario: true, nombre: true, apellido: true } },
      rolProyecto: { select: { nombre: true } },
      rolEstudiante: { select: { nombre: true } },
    },
  },
  objetivos: {
    orderBy: { id_objetivo: "asc" as const },
    include: {
      metas: true,
      actividadesCronograma: { include: { meta: true } },
    },
  },
  productos: {
    include: {
      tipoProducto: { include: { subcategoria: { include: { categoria: true } } } },
    },
  },
  equiposAdquiridos: { orderBy: { id_equipo: "asc" as const } },
  materialBibliografico: { orderBy: { id_material: "asc" as const } },
  novedades: {
    include: { solicitadaPor: { select: { nombre: true, apellido: true } }, decididoPor: { select: { nombre: true, apellido: true } } },
    orderBy: { fecha_solicitud: "desc" as const },
  },
  periodosInforme: {
    include: {
      informes: {
        include: {
          actividades: { include: { evidencias: true, actividad: true, meta: true } },
        },
      },
    },
    orderBy: { numero_periodo: "asc" as const },
  },
  informesFinales: {
    take: 1,
    orderBy: { id_informe_final: "desc" as const },
    include: {
      revisadoPor: { select: { nombre: true, apellido: true } },
      personas: true,
      cumplimientos: { orderBy: { id_cumplimiento: "asc" as const }, include: { objetivo: true } },
      resultadosProductos: { include: { evidencias: true, proyectoProducto: true } },
      actasCierre: { take: 1, orderBy: { id_acta_cierre: "desc" as const } },
    },
  },
} satisfies Prisma.ProyectoInclude;

type ProyectoConSeguimiento = Prisma.ProyectoGetPayload<{
  include: typeof INCLUDE_PROYECTO_SEGUIMIENTO;
}>;

function nombreDe(p: { usuario: { nombre: string; apellido: string } | null; nombre_manual: string | null; apellido_manual: string | null }): string {
  if (p.usuario) return `${p.usuario.nombre} ${p.usuario.apellido}`.trim();
  return [p.nombre_manual, p.apellido_manual].filter(Boolean).join(" ").trim() || "—";
}

function nombreCompleto(u: { nombre: string; apellido: string } | null): string {
  return u ? `${u.nombre} ${u.apellido}`.trim() : "";
}

async function firmasDeDocumento(tipo: string, id_referencia: number) {
  const filas = await prisma.firmaDocumento.findMany({
    where: { tipo_documento_firmado: tipo, id_referencia },
    include: { usuario: { select: { nombre: true, apellido: true } } },
    orderBy: { orden_firma: "asc" },
  });
  return filas.map((f) => ({
    id_firma: f.id_firma,
    rol: f.rol_firmante,
    firmado: f.firmado,
    fecha: f.fecha_firma ? f.fecha_firma.toISOString().slice(0, 10) : null,
    nombre: nombreCompleto(f.usuario),
  }));
}

/** Roles que firman cada tipo de documento, en orden — igual que ROLES_FIRMA_* de reglas.ts del frontend. */
const ROLES_FIRMA: Record<string, string[]> = {
  informe_avance: ["Investigador principal", "Co-investigadores"],
  informe_final: ["Investigador principal", "Co-investigadores", "Líder del grupo"],
  acta_cierre: ["Investigador principal", "Co-investigadores", "Líder del grupo", "Vicerrector", "Administrador"],
};

/**
 * Crea, si no existen todavía, las filas de FirmaDocumento de un documento
 * recién generado — en el orden fijo de ROLES_FIRMA. El frontend asume que
 * `firmas` siempre tiene esa longitud y ese orden desde que el documento
 * existe, así que se crean de una vez (no se calculan dinámicamente).
 */
async function asegurarFirmas(tipo: string, id_referencia: number, resolverUsuario: (rol: string) => Promise<number | null>) {
  const yaExisten = await prisma.firmaDocumento.count({ where: { tipo_documento_firmado: tipo, id_referencia } });
  if (yaExisten > 0) return;
  const roles = ROLES_FIRMA[tipo] ?? [];
  for (let i = 0; i < roles.length; i++) {
    const id_usuario = await resolverUsuario(roles[i]);
    if (!id_usuario) continue; // sin alguien real para ese rol todavía (ej. sin Líder asignado al grupo): se omite, no bloquea el resto.
    await prisma.firmaDocumento.create({
      data: { tipo_documento_firmado: tipo, id_referencia, id_usuario, rol_firmante: roles[i], orden_firma: i + 1 },
    });
  }
}

/** Genera (o actualiza, conservando lo ya diligenciado) los periodos de informe de avance de un proyecto, según la duración real del acta + prórrogas aprobadas. */
export async function regenerarPeriodos(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const proyecto = await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  const acta = proyecto.actasInicio[0];
  if (!acta || !acta.fecha_inicio || !acta.duracion_meses) return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);

  const prorrogaMeses = await prorrogaAprobadaMeses(id_proyecto);
  const duracionTotal = acta.duracion_meses + prorrogaMeses;
  const cantidadPeriodos = Math.max(1, Math.ceil(duracionTotal / MESES_POR_PERIODO));

  const periodosExistentes = await prisma.periodoInforme.findMany({ where: { id_proyecto }, orderBy: { numero_periodo: "asc" } });

  for (let i = 0; i < cantidadPeriodos; i++) {
    const numero = i + 1;
    const apertura = sumarMeses(acta.fecha_inicio, i * MESES_POR_PERIODO);
    const limite = restarUnDia(sumarMeses(acta.fecha_inicio, Math.min((i + 1) * MESES_POR_PERIODO, duracionTotal)));

    const existente = periodosExistentes.find((p) => p.numero_periodo === numero);
    let idPeriodo: number;
    if (existente) {
      await prisma.periodoInforme.update({
        where: { id_periodo_informe: existente.id_periodo_informe },
        data: { fecha_apertura: apertura, fecha_limite: limite, anio: apertura.getFullYear() },
      });
      idPeriodo = existente.id_periodo_informe;
    } else {
      const creado = await prisma.periodoInforme.create({
        data: { id_proyecto, numero_periodo: numero, anio: apertura.getFullYear(), fecha_apertura: apertura, fecha_limite: limite },
      });
      idPeriodo = creado.id_periodo_informe;
    }

    // Igual que el frontend: cada periodo tiene, desde que existe, su único
    // InformeAvance con una fila de actividad por cada actividad del
    // cronograma — así nunca hay que decidir "cuál informe es el vigente".
    const yaTieneInforme = await prisma.informeAvance.count({ where: { id_periodo_informe: idPeriodo } });
    if (yaTieneInforme === 0) {
      const informe = await prisma.informeAvance.create({
        data: { id_proyecto, id_periodo_informe: idPeriodo, radicado_por: proyecto.creado_por },
      });
      for (const act of proyecto.objetivos.flatMap((o) => o.actividadesCronograma)) {
        await prisma.informeAvanceActividad.create({
          data: {
            id_informe_avance: informe.id_informe_avance,
            id_actividad: act.id_actividad,
            id_meta: act.id_meta,
            responsable: proyecto.creado_por,
            estado_actividad: "no iniciada",
            semanas_trabajadas: Array(SEMANAS_POR_PERIODO).fill(false),
          },
        });
      }
      await asegurarFirmas("informe_avance", informe.id_informe_avance, (rol) => resolverFirmanteProyecto(proyecto, rol));
    }
  }

  // Periodos de más (la duración se acortó) se dejan — no se borra historial;
  // simplemente quedan fuera del rango que importa (el frontend tampoco los borra).
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

async function prorrogaAprobadaMeses(id_proyecto: number): Promise<number> {
  const novedades = await prisma.novedadProyecto.findMany({
    where: { id_proyecto, estado: "aprobada", nombre_tipo: "Prórroga" },
    select: { tiempo_prorroga_meses: true },
  });
  return novedades.reduce((acc, n) => acc + (n.tiempo_prorroga_meses ?? 0), 0);
}

function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return d;
}
function restarUnDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() - 1);
  return d;
}

/** Resuelve quién es la persona real para un rol de firma, dentro de este proyecto — mismo criterio que acta-inicio: principal = creador, co-investigador = primer co-investigador UNICESMAG, líder = GrupoInvestigacion.id_lider, vicerrector/administrador = primer usuario activo con ese rol. */
async function resolverFirmanteProyecto(proyecto: ProyectoConSeguimiento, rol: string): Promise<number | null> {
  if (rol === "Investigador principal") return proyecto.creado_por;
  if (rol === "Co-investigadores") {
    const co = proyecto.participantes.find((p) => p.rolProyecto.nombre === ROL_COINVESTIGADOR_INTERNO && p.usuario);
    return co?.usuario?.id_usuario ?? null;
  }
  if (rol === "Líder del grupo") {
    const idGrupo = proyecto.grupos[0]?.grupo ? (await prisma.grupoInvestigacion.findFirst({ where: { proyectos: { some: { id_proyecto: proyecto.id_proyecto } } }, select: { id_lider: true } }))?.id_lider : null;
    if (idGrupo) return idGrupo;
    // Mientras no exista cuenta de Líder, el investigador principal firma también en ese puesto.
    return proyecto.creado_por;
  }
  if (rol === "Vicerrector" || rol === "Administrador") {
    const nombreRol = rol === "Vicerrector" ? "Vicerrector" : "Administrador";
    const usuario = await prisma.usuario.findFirst({ where: { activo: true, roles: { some: { rol: { nombre: nombreRol } } } }, select: { id_usuario: true } });
    return usuario?.id_usuario ?? null;
  }
  return null;
}

async function obtenerProyectoCrudo(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta): Promise<ProyectoConSeguimiento> {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id_proyecto, actasInicio: { some: { estado: "legalizada" } } },
    include: INCLUDE_PROYECTO_SEGUIMIENTO,
  });
  if (!proyecto) throw new ProyectoSeguimientoNoEncontradoError();
  if (!esAdministradorOVicerrector(usuarioQueConsulta)) {
    const participa = proyecto.creado_por === usuarioQueConsulta.id_usuario ||
      proyecto.participantes.some((p) => p.usuario?.id_usuario === usuarioQueConsulta.id_usuario);
    if (!participa) throw new NoParticipaEnProyectoError();
  }
  return proyecto;
}

async function ensamblar(proyecto: ProyectoConSeguimiento) {
  const principal = proyecto.participantes.find((p) => p.rolProyecto.nombre === ROL_PRINCIPAL);
  const acta = proyecto.actasInicio[0] ?? null;
  const prorrogaMeses = await prorrogaAprobadaMeses(proyecto.id_proyecto);

  const metas = proyecto.objetivos.flatMap((o) =>
    o.actividadesCronograma.map((act) => ({
      objetivo: o.descripcion,
      meta: act.meta?.descripcion ?? "",
      actividad: act.actividad,
      responsable: act.responsable_manual ?? "",
    }))
  );

  const periodos = await Promise.all(
    proyecto.periodosInforme.map(async (periodo) => {
      const informe = periodo.informes[0] ?? null;
      const firmas = informe ? await firmasDeDocumento("informe_avance", informe.id_informe_avance) : [];
      return {
        numero: periodo.numero_periodo,
        anio: periodo.anio,
        apertura: periodo.fecha_apertura.toISOString().slice(0, 10),
        limite: periodo.fecha_limite.toISOString().slice(0, 10),
        estado: periodo.estado,
        fecha_solicitud: periodo.fecha_solicitud ? periodo.fecha_solicitud.toISOString().slice(0, 10) : null,
        fecha_habilitacion: periodo.fecha_habilitacion ? periodo.fecha_habilitacion.toISOString().slice(0, 10) : null,
        observacion_solicitud: periodo.observacion_solicitud ?? "",
        fecha_radicacion: informe?.fecha_radicacion ? informe.fecha_radicacion.toISOString().slice(0, 10) : null,
        observacion_revision: informe?.observacion_revision ?? "",
        detalle: (informe?.actividades ?? []).map((a) => ({
          id_actividad: a.id_actividad,
          actividad: a.actividad.actividad,
          estado: estadoActividadLegible(a.estado_actividad),
          porcentaje: a.porcentaje_cumplimiento,
          observacion: a.observacion ?? "",
          semanas: a.semanas_trabajadas.length === SEMANAS_POR_PERIODO ? a.semanas_trabajadas : Array(SEMANAS_POR_PERIODO).fill(false),
          evidencias: a.evidencias.map((e) => ({
            tipo: e.tipo_evidencia === "enlace" ? ("enlace" as const) : ("archivo" as const),
            archivo: e.archivo,
            url: e.enlace,
            descripcion: e.descripcion ?? "",
          })),
        })),
        firmas,
      };
    })
  );

  const novedades = proyecto.novedades.map((n) => ({
    id: n.id_novedad,
    id_tipo: n.id_tipo_novedad,
    tipo: n.nombre_tipo,
    fecha: n.fecha_solicitud.toISOString().slice(0, 10),
    justificacion: n.motivo,
    soporte: n.soporte ?? "",
    meses_prorroga: n.tiempo_prorroga_meses ?? 0,
    participante_saliente: n.participante_saliente,
    participante_entrante: n.participante_entrante,
    acto_administrativo: n.acto_administrativo ?? "",
    estado: estadoNovedadLegible(n.estado),
    observacion: n.observacion_decision ?? "",
  }));

  const productos = proyecto.productos.map((pp) => ({
    id: pp.id_proyecto_producto,
    categoria: pp.tipoProducto.subcategoria.categoria.nombre,
    nombre: pp.tipoProducto.nombre,
    proyectado: pp.cantidad,
    obtenido: pp.cantidad_obtenida,
    observacion: "",
    soportes: [] as { tipo: "archivo" | "enlace"; archivo: string | null; url: string | null; descripcion: string }[],
  }));

  const informeFinal = proyecto.informesFinales[0] ?? null;
  const cierre = informeFinal?.actasCierre[0] ?? null;

  // Los soportes del "obtenido" de cada producto viven en el informe final
  // (ResultadoProducto), una vez existe — se superponen sobre el valor base
  // de ProyectoProducto (que es la fuente mientras no hay informe final).
  if (informeFinal) {
    for (const r of informeFinal.resultadosProductos) {
      const p = productos.find((x) => x.id === r.proyectoProducto.id_proyecto_producto);
      if (!p) continue;
      p.obtenido = r.cantidad_obtenida;
      p.observacion = r.observaciones ?? "";
      p.soportes = r.evidencias.map((e) => ({
        tipo: e.tipo_evidencia === "enlace" ? ("enlace" as const) : ("archivo" as const),
        archivo: e.archivo,
        url: e.enlace,
        descripcion: e.descripcion ?? "",
      }));
    }
  }

  const personaVacia = { nombre: "", grupo: "", programa: "", correo: "", telefono: "" };
  const personaInfo = (rol: string) => {
    const p = informeFinal?.personas.find((x) => x.rol === rol);
    return p ? { nombre: p.nombre ?? "", grupo: p.grupo ?? "", programa: p.programa ?? "", correo: p.correo ?? "", telefono: p.telefono ?? "" } : personaVacia;
  };
  const apoyos = (informeFinal?.apoyos as { nombre: string; tipo: "Auxiliar" | "Asistente"; codigo_estudiantil: string; correo: string }[] | null) ?? [];

  return {
    id_proyecto: proyecto.id_proyecto,
    titulo: proyecto.titulo,
    investigador_principal: principal ? nombreDe(principal) : "",
    programa_academico: "",
    equipo: {
      co_investigadores_internos: proyecto.participantes.filter((p) => p.rolProyecto.nombre === ROL_COINVESTIGADOR_INTERNO).map(nombreDe),
      co_investigadores_externos: proyecto.participantes.filter((p) => p.rolProyecto.nombre === ROL_COINVESTIGADOR_EXTERNO).map(nombreDe),
      auxiliares: proyecto.participantes.filter((p) => p.rolProyecto.nombre === ROL_ESTUDIANTE && p.rolEstudiante?.nombre === "auxiliar").map(nombreDe),
      asistentes: proyecto.participantes.filter((p) => p.rolProyecto.nombre === ROL_ESTUDIANTE && p.rolEstudiante?.nombre === "asistente").map(nombreDe),
    },
    grupo: proyecto.grupos[0]?.grupo.nombre ?? "",
    convocatoria: proyecto.convocatoria.nombre,
    modalidad: proyecto.modalidad.nombre,
    articulacion: proyecto.tipoArticulacion?.nombre ?? "",
    centro_costos: acta?.centro_costos ?? "",
    fecha_inicio: acta?.fecha_inicio ? acta.fecha_inicio.toISOString().slice(0, 10) : "",
    duracion_meses: acta?.duracion_meses ?? 0,
    prorroga_meses: prorrogaMeses,
    participantes: proyecto.participantes.map((p) => `${p.rolProyecto.nombre} · ${nombreDe(p)}${p.activo ? "" : " (retirado)"}`),
    vigencias: (proyecto.financiacion?.vigencias ?? []).map((v) => ({
      anio: v.anio,
      asignado: Number(v.valor_asignado),
      ejecutado: Number(v.valor_ejecutado),
    })),
    metas,
    periodos,
    novedades,
    productos,
    informe_final: informeFinal
      ? {
          info: {
            area_conocimiento: informeFinal.area_conocimiento ?? "",
            ciudad: informeFinal.ciudad ?? "",
            departamento: informeFinal.departamento ?? "",
            financiacion_externa: Number(informeFinal.financiacion_externa) || 0,
            investigador_principal: personaInfo("principal"),
            co_investigador_interno: personaInfo("co_interno"),
            co_investigador_externo: personaInfo("co_externo"),
            apoyos,
          },
          resumen: informeFinal.resumen_ejecucion ?? "",
          objetivos: informeFinal.cumplimientos.map((c) => ({
            titulo: c.objetivo.descripcion,
            descripcion: c.descripcion_cumplimiento,
            cumplido: c.cumplido,
            cumplimiento: c.cumplido ? "Cumplido" : c.observacion ?? "",
          })),
          observaciones_objetivos: informeFinal.observaciones_objetivos ?? "",
          equipos: proyecto.equiposAdquiridos.map((e) => [
            e.denominacion,
            e.fecha_adquisicion ? e.fecha_adquisicion.toISOString().slice(0, 10) : "",
            e.estado ?? "",
            e.codigo_inventario ?? "",
            e.observaciones ?? "",
          ]),
          materiales: proyecto.materialBibliografico.map((m) => [
            m.nombre_material,
            m.fecha_adquisicion ? m.fecha_adquisicion.toISOString().slice(0, 10) : "",
            m.isbn_issn ?? "",
            m.codigo_inventario ?? "",
            m.observaciones ?? "",
          ]),
          actividades_apoyos: informeFinal.actividades_estudiantes ?? "",
          evidencias_apoyos: informeFinal.evidencias_estudiantes ?? "",
          estado: estadoInformeFinalLegible(informeFinal.estado),
          fecha_solicitud: informeFinal.fecha_solicitud ? informeFinal.fecha_solicitud.toISOString().slice(0, 10) : null,
          fecha_habilitacion: informeFinal.fecha_habilitacion ? informeFinal.fecha_habilitacion.toISOString().slice(0, 10) : null,
          observacion_solicitud: informeFinal.observacion_solicitud ?? "",
          fecha_entrega: informeFinal.fecha_radicacion ? informeFinal.fecha_radicacion.toISOString().slice(0, 10) : null,
          observacion_devolucion: informeFinal.observacion_revision ?? "",
          revisado_por:
            informeFinal.estado === "aprobado" && informeFinal.revisadoPor && informeFinal.fecha_revision
              ? { nombre: nombreCompleto(informeFinal.revisadoPor), fecha: informeFinal.fecha_revision.toISOString().slice(0, 10) }
              : null,
          firmas: await firmasDeDocumento("informe_final", informeFinal.id_informe_final),
        }
      : // Blanco por defecto: el frontend trata "informe_final" como parte
        // inseparable del proyecto, no como un documento opcional — aquí
        // todavía no existe la fila real porque nadie lo ha diligenciado.
        {
          info: {
            area_conocimiento: "", ciudad: "", departamento: "", financiacion_externa: 0,
            investigador_principal: personaVacia, co_investigador_interno: personaVacia, co_investigador_externo: personaVacia,
            apoyos: [] as { nombre: string; tipo: "Auxiliar" | "Asistente"; codigo_estudiantil: string; correo: string }[],
          },
          resumen: "", objetivos: [] as { titulo: string; descripcion: string; cumplido: boolean; cumplimiento: string }[],
          observaciones_objetivos: "",
          equipos: [] as string[][], materiales: [] as string[][],
          actividades_apoyos: "", evidencias_apoyos: "",
          estado: "Borrador", fecha_solicitud: null, fecha_habilitacion: null, observacion_solicitud: "",
          fecha_entrega: null, observacion_devolucion: "",
          revisado_por: null as { nombre: string; fecha: string } | null,
          firmas: [] as { id_firma: number; rol: string; firmado: boolean; fecha: string | null; nombre: string }[],
        },
    cierre: cierre
      ? {
          linea_investigacion_principal: cierre.linea_investigacion_principal ?? "",
          linea_investigacion_co: cierre.linea_investigacion_co ?? "",
          programas_estudiantes: cierre.programas_estudiantes,
          libros: cierre.libros ?? 0,
          libros_soporte: cierre.libros_soporte ?? "",
          libros_observacion: cierre.libros_observacion ?? "",
          capitulos: cierre.capitulos ?? 0,
          capitulos_soporte: cierre.capitulos_soporte ?? "",
          capitulos_observacion: cierre.capitulos_observacion ?? "",
          fecha_fin_real: cierre.fecha_finalizacion_real ? cierre.fecha_finalizacion_real.toISOString().slice(0, 10) : "",
          paz_y_salvo: cierre.paz_y_salvo,
          ciudad: cierre.ciudad_firma ?? "",
          fecha_acta: cierre.fecha_acta ? cierre.fecha_acta.toISOString().slice(0, 10) : "",
          observaciones: cierre.observaciones ?? "",
          firmas: await firmasDeDocumento("acta_cierre", cierre.id_acta_cierre),
          finalizado: cierre.estado === "cerrada",
        }
      : {
          linea_investigacion_principal: "", linea_investigacion_co: "", programas_estudiantes: [] as string[],
          libros: 0, libros_soporte: "", libros_observacion: "",
          capitulos: 0, capitulos_soporte: "", capitulos_observacion: "",
          fecha_fin_real: "", paz_y_salvo: false, ciudad: "", fecha_acta: "", observaciones: "",
          firmas: [] as { id_firma: number; rol: string; firmado: boolean; fecha: string | null; nombre: string }[],
          finalizado: false,
        },
  };
}

function estadoActividadLegible(estado: string): string {
  const mapa: Record<string, string> = { "no iniciada": "No iniciada", "en ejecucion": "En ejecución", cumplida: "Cumplida", aplazada: "Aplazada" };
  return mapa[estado] ?? estado;
}
function estadoNovedadLegible(estado: string): string {
  const mapa: Record<string, string> = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" };
  return mapa[estado] ?? estado;
}
function estadoInformeFinalLegible(estado: string): string {
  const mapa: Record<string, string> = { borrador: "Borrador", radicado: "Radicado", aprobado: "Aprobado", devuelto: "Devuelto" };
  return mapa[estado] ?? estado;
}

export async function listarProyectosSeguimiento(usuarioQueConsulta: UsuarioQueConsulta) {
  const proyectos = await prisma.proyecto.findMany({
    where: {
      actasInicio: { some: { estado: "legalizada" } },
      ...(esAdministradorOVicerrector(usuarioQueConsulta)
        ? {}
        : { OR: [{ creado_por: usuarioQueConsulta.id_usuario }, { participantes: { some: { participante: usuarioQueConsulta.id_usuario } } }] }),
    },
    include: INCLUDE_PROYECTO_SEGUIMIENTO,
    orderBy: { id_proyecto: "desc" },
  });
  return Promise.all(proyectos.map(ensamblar));
}

export async function obtenerProyectoSeguimiento(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const proyecto = await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  return ensamblar(proyecto);
}

// ---------------------------------------------------------------------------
// Firmas secuenciales (helpers compartidos por avance, informe final y cierre)
// ---------------------------------------------------------------------------

const ROLES_FIRMA_OPCIONAL = ["Co-investigadores"];

/** Marca una firma como hecha — valida turno/rol la llama quien invoca esto. Si es "Administrador", el nombre que queda es el de quien de verdad la firmó (puede no ser el mismo que se preresolvió al crear el documento). */
async function marcarFirma(tipo: string, id_referencia: number, indice: number, usuarioQueFirma: UsuarioQueConsulta) {
  const firmas = await prisma.firmaDocumento.findMany({ where: { tipo_documento_firmado: tipo, id_referencia }, orderBy: { orden_firma: "asc" } });
  const firma = firmas[indice];
  exigir(firma && !firma.firmado, "Esa firma ya está registrada.");
  await prisma.firmaDocumento.update({
    where: { id_firma: firma.id_firma },
    data: {
      firmado: true,
      fecha_firma: new Date(),
      ...(firma.rol_firmante === "Administrador" ? { id_usuario: usuarioQueFirma.id_usuario } : {}),
    },
  });
  return firma;
}

async function reabrirFirmas(tipo: string, id_referencia: number) {
  await prisma.firmaDocumento.updateMany({ where: { tipo_documento_firmado: tipo, id_referencia }, data: { firmado: false, fecha_firma: null } });
}

function firmaPrincipalLista(firmas: { rol: string; firmado: boolean }[]): boolean {
  return Boolean(firmas.find((f) => f.rol === "Investigador principal")?.firmado);
}

function firmasObligatoriasListas(firmas: { rol: string; firmado: boolean }[], opcionales: string[] = ROLES_FIRMA_OPCIONAL): boolean {
  return firmas.filter((f) => !opcionales.includes(f.rol)).every((f) => f.firmado);
}

function exigirTurnoFirma(firmas: { rol: string; firmado: boolean }[], indice: number, opcionales: string[] = ROLES_FIRMA_OPCIONAL) {
  const anteriores = firmas.slice(0, indice).filter((f) => !opcionales.includes(f.rol));
  exigir(anteriores.every((f) => f.firmado), "No es el turno de esta firma.");
}

// ---------------------------------------------------------------------------
// M-03 Informes de avance
// ---------------------------------------------------------------------------

function mensajeBloqueoPeriodo(numero: number): string {
  return `El periodo ${numero} se desbloquea cuando se apruebe el avance del periodo ${numero - 1}.`;
}

/** Igual que periodoBloqueadoPorOrden del frontend: un periodo sin trabajo propio (sigue "programado") no se habilita hasta que el anterior quede "aprobado". */
async function periodoBloqueadoPorOrden(id_proyecto: number, numero: number): Promise<boolean> {
  if (numero <= 1) return false;
  const [actual, anterior] = await Promise.all([
    prisma.periodoInforme.findFirst({ where: { id_proyecto, numero_periodo: numero } }),
    prisma.periodoInforme.findFirst({ where: { id_proyecto, numero_periodo: numero - 1 } }),
  ]);
  if (!actual || actual.estado !== "programado") return false;
  return !anterior || anterior.estado !== "aprobado";
}

async function obtenerPeriodoConInforme(id_proyecto: number, numero: number, usuarioQueConsulta: UsuarioQueConsulta) {
  await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta); // valida existencia + permiso
  const periodo = await prisma.periodoInforme.findFirst({
    where: { id_proyecto, numero_periodo: numero },
    include: { informes: { include: { actividades: { include: { evidencias: true, actividad: { select: { actividad: true } } } } } } },
  });
  exigir(periodo, "El periodo no existe.");
  const informe = periodo!.informes[0];
  exigir(informe, "El periodo no tiene un informe de avance asociado.");
  return { periodo: periodo!, informe: informe! };
}

const periodoSolicitado = (p: { estado: string; fecha_solicitud: Date | null }) => p.estado !== "programado" || Boolean(p.fecha_solicitud);
const periodoHabilitado = (p: { estado: string; fecha_habilitacion: Date | null }) => p.estado !== "programado" || Boolean(p.fecha_habilitacion);
const solicitudPendiente = (p: { estado: string; fecha_solicitud: Date | null; fecha_habilitacion: Date | null }) =>
  p.estado === "programado" && Boolean(p.fecha_solicitud) && !p.fecha_habilitacion;
const periodoAbierto = (p: { estado: string }) => p.estado !== "radicado" && p.estado !== "aprobado";

async function periodoEditable(id_proyecto: number, idInformeAvance: number, periodo: { estado: string }): Promise<boolean> {
  if (!periodoAbierto(periodo)) return false;
  const algunaFirmada = await prisma.firmaDocumento.count({ where: { tipo_documento_firmado: "informe_avance", id_referencia: idInformeAvance, firmado: true } });
  return algunaFirmada === 0;
}

function faltanEvidencias(actividades: { porcentaje_cumplimiento: number; evidencias: unknown[] }[]): boolean {
  // "previo" (con el que llegó el periodo) no se persiste — se usa el valor actual antes de guardar, que en este
  // punto todavía refleja lo heredado del periodo anterior (ver guardarAvance, que valida contra `previos` aparte).
  return actividades.some((a) => a.porcentaje_cumplimiento < 100) && actividades.every((a) => a.evidencias.length === 0);
}

const MENSAJE_EVIDENCIA_MINIMA = "Agrega al menos una evidencia del informe (archivo adjunto o enlace), en cualquiera de las actividades.";

/** POST /seguimiento/proyectos/:id/periodos/:numero/solicitud */
export async function solicitarAvance(id_proyecto: number, numero: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { periodo } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(!(await periodoBloqueadoPorOrden(id_proyecto, numero)), mensajeBloqueoPeriodo(numero));
  exigir(!periodoSolicitado(periodo), "Este informe ya fue solicitado.");
  await prisma.periodoInforme.update({
    where: { id_periodo_informe: periodo.id_periodo_informe },
    data: { fecha_solicitud: new Date(), fecha_habilitacion: null, observacion_solicitud: "" },
  });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** PATCH /seguimiento/proyectos/:id/periodos/:numero/solicitud */
export async function decidirSolicitudAvance(
  id_proyecto: number,
  numero: number,
  decision: "Habilitar" | "Rechazar",
  observacion: string,
  usuarioQueConsulta: UsuarioQueConsulta
) {
  const { periodo } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(solicitudPendiente(periodo), "Este informe no tiene una solicitud pendiente.");
  if (decision === "Habilitar") {
    await prisma.periodoInforme.update({ where: { id_periodo_informe: periodo.id_periodo_informe }, data: { fecha_habilitacion: new Date(), observacion_solicitud: "" } });
  } else {
    exigir(observacion.trim(), "Indica el motivo del rechazo.");
    await prisma.periodoInforme.update({ where: { id_periodo_informe: periodo.id_periodo_informe }, data: { fecha_solicitud: null, observacion_solicitud: observacion.trim() } });
  }
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

export interface DetalleAvanceEntrada {
  id_actividad: number;
  porcentaje: number;
  estado?: "Aplazada";
  observacion: string;
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero */
export async function guardarAvance(id_proyecto: number, numero: number, detalle: DetalleAvanceEntrada[], usuarioQueConsulta: UsuarioQueConsulta) {
  const { periodo, informe } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(!(await periodoBloqueadoPorOrden(id_proyecto, numero)), mensajeBloqueoPeriodo(numero));
  exigir(periodoAbierto(periodo), "Este informe ya fue radicado y no se puede editar.");
  exigir(periodoHabilitado(periodo), "El Administrador debe habilitar el informe de avance antes de diligenciarlo.");
  exigir(await periodoEditable(id_proyecto, informe.id_informe_avance, periodo), "El informe ya tiene firmas: reábrelo para poder editarlo.");

  // "previo": lo que trae cada actividad ahora mismo es justo lo heredado del periodo anterior aprobado
  // (generado al crear/arrastrar el periodo) — no se guarda aparte, se usa el valor actual como referencia.
  const previos = new Map(informe.actividades.map((a) => [a.id_actividad, a.porcentaje_cumplimiento]));

  for (const d of detalle) {
    const previo = previos.get(d.id_actividad) ?? 0;
    const porcentaje = Math.max(0, Math.min(100, Math.round(d.porcentaje) || 0));
    const actividad = informe.actividades.find((a) => a.id_actividad === d.id_actividad);
    exigir(porcentaje >= previo, `«${actividad?.actividad.actividad ?? `Actividad ${d.id_actividad}`}» no puede quedar por debajo del avance del periodo anterior (${previo} %).`);
  }

  await prisma.$transaction(
    detalle.map((d) => {
      const porcentaje = Math.max(0, Math.min(100, Math.round(d.porcentaje) || 0));
      const actividadInforme = informe.actividades.find((a) => a.id_actividad === d.id_actividad)!;
      return prisma.informeAvanceActividad.update({
        where: { id_informe_actividad: actividadInforme.id_informe_actividad },
        data: {
          porcentaje_cumplimiento: porcentaje,
          estado_actividad: d.estado === "Aplazada" ? "aplazada" : porcentaje === 0 ? "no iniciada" : porcentaje === 100 ? "cumplida" : "en ejecucion",
          observacion: d.observacion,
        },
      });
    })
  );

  const actividadesFrescas = await prisma.informeAvanceActividad.findMany({ where: { id_informe_avance: informe.id_informe_avance }, include: { evidencias: true } });
  const todasCumplidasPrevio = informe.actividades.every((a) => a.porcentaje_cumplimiento >= 100);
  if (!todasCumplidasPrevio) {
    const faltan: string[] = [];
    if (!actividadesFrescas.some((a) => a.semanas_trabajadas.some(Boolean))) faltan.push("Señala en el cronograma al menos una semana trabajada.");
    if (!detalle.some((d) => d.porcentaje > (previos.get(d.id_actividad) ?? 0))) faltan.push("Indica un porcentaje de avance en al menos una actividad.");
    if (faltanEvidencias(actividadesFrescas)) faltan.push(MENSAJE_EVIDENCIA_MINIMA);
    exigir(faltan.length === 0, "Completa los campos del informe antes de guardarlo.", faltan);
  }

  await prisma.periodoInforme.update({ where: { id_periodo_informe: periodo.id_periodo_informe }, data: { estado: "borrador" } });
  await prisma.informeAvance.update({
    where: { id_informe_avance: informe.id_informe_avance },
    data: { estado: "borrador", porcentaje_avance: Math.round(actividadesFrescas.reduce((t, a) => t + a.porcentaje_cumplimiento, 0) / Math.max(1, actividadesFrescas.length)) },
  });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero/semanas/:idActividad — marcar/desmarcar las semanas trabajadas de una actividad (parte del cronograma INV-IC-FR-018, se guarda aparte del resto del detalle). */
export async function guardarSemanasActividad(
  id_proyecto: number,
  numero: number,
  id_actividad: number,
  semanas: boolean[],
  usuarioQueConsulta: UsuarioQueConsulta
) {
  const { periodo, informe } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(!(await periodoBloqueadoPorOrden(id_proyecto, numero)), mensajeBloqueoPeriodo(numero));
  exigir(periodoAbierto(periodo) && periodoHabilitado(periodo), "Este informe no se puede editar.");
  const actividad = informe.actividades.find((a) => a.id_actividad === id_actividad);
  exigir(actividad, "Esa actividad no pertenece a este informe.");
  await prisma.informeAvanceActividad.update({
    where: { id_informe_actividad: actividad!.id_informe_actividad },
    data: { semanas_trabajadas: Array.from({ length: SEMANAS_POR_PERIODO }, (_, i) => Boolean(semanas[i])) },
  });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/firmas/:indice */
export async function firmarAvance(id_proyecto: number, numero: number, indice: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { periodo, informe } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(!(await periodoBloqueadoPorOrden(id_proyecto, numero)), mensajeBloqueoPeriodo(numero));
  const firmas = await firmasDeDocumento("informe_avance", informe.id_informe_avance);
  const firma = firmas[indice];
  exigir(firma && !firma.firmado, "Esa firma ya está registrada.");
  if (firma.rol === "Investigador principal") {
    exigir(periodoAbierto(periodo), "Este informe ya fue radicado.");
    exigir(periodo.estado !== "programado", "Guarda el informe antes de firmarlo.");
    const actividades = await prisma.informeAvanceActividad.findMany({ where: { id_informe_avance: informe.id_informe_avance }, include: { evidencias: true } });
    exigir(!faltanEvidencias(actividades), MENSAJE_EVIDENCIA_MINIMA);
  } else {
    exigir(firmaPrincipalLista(firmas), "Primero firma el investigador principal.");
    exigir(periodo.estado !== "programado", "Guarda el informe antes de firmarlo.");
  }
  await marcarFirma("informe_avance", informe.id_informe_avance, indice, usuarioQueConsulta);
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** DELETE /seguimiento/proyectos/:id/periodos/:numero/firmas */
export async function reabrirAvance(id_proyecto: number, numero: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { periodo, informe } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(!(await periodoBloqueadoPorOrden(id_proyecto, numero)), mensajeBloqueoPeriodo(numero));
  exigir(periodoAbierto(periodo), "Este informe ya fue radicado.");
  await reabrirFirmas("informe_avance", informe.id_informe_avance);
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/radicar */
export async function radicarAvance(id_proyecto: number, numero: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { periodo, informe } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(!(await periodoBloqueadoPorOrden(id_proyecto, numero)), mensajeBloqueoPeriodo(numero));
  exigir(periodoAbierto(periodo), "Este informe ya fue radicado.");
  const actividades = await prisma.informeAvanceActividad.findMany({ where: { id_informe_avance: informe.id_informe_avance }, include: { evidencias: true } });
  exigir(!faltanEvidencias(actividades), MENSAJE_EVIDENCIA_MINIMA);
  const firmas = await firmasDeDocumento("informe_avance", informe.id_informe_avance);
  exigir(firmaPrincipalLista(firmas), "Falta la firma del investigador principal para radicar el informe.");
  await prisma.periodoInforme.update({ where: { id_periodo_informe: periodo.id_periodo_informe }, data: { estado: "radicado" } });
  await prisma.informeAvance.update({ where: { id_informe_avance: informe.id_informe_avance }, data: { estado: "radicado", fecha_radicacion: new Date(), observacion_revision: "" } });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** PATCH /seguimiento/proyectos/:id/periodos/:numero/revision */
export async function revisarAvance(
  id_proyecto: number,
  numero: number,
  decision: "Aprobado" | "Devuelto",
  observacion: string,
  revisor: number,
  usuarioQueConsulta: UsuarioQueConsulta
) {
  const { periodo, informe } = await obtenerPeriodoConInforme(id_proyecto, numero, usuarioQueConsulta);
  exigir(periodo.estado === "radicado", "Solo se revisan informes radicados.");
  exigir(decision === "Aprobado" || observacion.trim(), "Indica las observaciones de la devolución.");
  const estadoNuevo = decision === "Aprobado" ? "aprobado" : "devuelto";
  await prisma.periodoInforme.update({ where: { id_periodo_informe: periodo.id_periodo_informe }, data: { estado: estadoNuevo } });
  await prisma.informeAvance.update({
    where: { id_informe_avance: informe.id_informe_avance },
    data: {
      estado: estadoNuevo,
      observacion_revision: decision === "Devuelto" ? observacion.trim() : "",
      revisado_por: decision === "Aprobado" ? revisor : null,
      fecha_revision: decision === "Aprobado" ? new Date() : null,
    },
  });
  if (decision === "Aprobado") {
    const siguiente = await prisma.periodoInforme.findFirst({
      where: { id_proyecto, numero_periodo: numero + 1, estado: "programado" },
      include: { informes: { include: { actividades: true } } },
    });
    if (siguiente?.informes[0]) {
      const actividadesAprobadas = await prisma.informeAvanceActividad.findMany({ where: { id_informe_avance: informe.id_informe_avance } });
      for (const act of siguiente.informes[0].actividades) {
        const previa = actividadesAprobadas.find((a) => a.id_actividad === act.id_actividad);
        if (!previa) continue;
        await prisma.informeAvanceActividad.update({
          where: { id_informe_actividad: act.id_informe_actividad },
          data: {
            porcentaje_cumplimiento: previa.porcentaje_cumplimiento,
            estado_actividad: previa.estado_actividad === "aplazada" ? "aplazada" : previa.porcentaje_cumplimiento === 100 ? "cumplida" : previa.porcentaje_cumplimiento === 0 ? "no iniciada" : "en ejecucion",
          },
        });
      }
    }
  } else {
    await reabrirFirmas("informe_avance", informe.id_informe_avance);
  }
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

// ---------------------------------------------------------------------------
// M-05 Novedades
// ---------------------------------------------------------------------------

export interface DatosNovedad {
  id_tipo: number;
  justificacion: string;
  soporte: string;
  meses_prorroga: number;
  participante_saliente: string;
  participante_entrante: string;
  acto_administrativo: string;
}

/** POST /seguimiento/proyectos/:id/novedades */
export async function registrarNovedad(id_proyecto: number, datos: DatosNovedad, usuarioQueConsulta: UsuarioQueConsulta) {
  await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  const tipo = await prisma.tipoNovedad.findFirst({ where: { id_tipo_novedad: datos.id_tipo, activo: true } });
  exigir(tipo, "Selecciona un tipo de novedad.");
  exigir(datos.justificacion.trim(), "La justificación es obligatoria.");
  exigir(datos.soporte.trim(), "El soporte es obligatorio.");
  const cancelacion = tipo.nombre === "Cancelación";
  if (cancelacion) exigir(datos.acto_administrativo.trim(), "El acto administrativo es obligatorio.");
  if (tipo.afecta_fechas && !cancelacion) exigir(datos.meses_prorroga >= 1, "Indica los meses de ampliación.");
  if (tipo.afecta_participantes && !cancelacion) exigir(datos.participante_saliente, "Selecciona el participante saliente.");

  await prisma.novedadProyecto.create({
    data: {
      id_proyecto,
      id_tipo_novedad: tipo.id_tipo_novedad,
      nombre_tipo: tipo.nombre,
      solicitada_por: usuarioQueConsulta.id_usuario,
      motivo: datos.justificacion.trim(),
      soporte: datos.soporte.trim(),
      tiempo_prorroga_meses: tipo.afecta_fechas && !cancelacion ? datos.meses_prorroga : 0,
      participante_saliente: tipo.afecta_participantes && !cancelacion ? datos.participante_saliente : "",
      participante_entrante: tipo.afecta_participantes && !cancelacion ? datos.participante_entrante : "",
      acto_administrativo: cancelacion ? datos.acto_administrativo.trim() : "",
    },
  });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** PATCH /seguimiento/proyectos/:id/novedades/:idNovedad — la VIE decide.
 * Una prórroga aprobada amplía la duración y reprograma los periodos pendientes. */
export async function decidirNovedad(
  id_proyecto: number,
  id_novedad: number,
  decision: "Aprobada" | "Rechazada",
  observacion: string,
  usuarioQueConsulta: UsuarioQueConsulta
) {
  exigir(observacion.trim(), "La observación es obligatoria.");
  const proyecto = await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  const novedad = proyecto.novedades.find((n) => n.id_novedad === id_novedad);
  exigir(novedad && novedad.estado === "pendiente", "La novedad ya fue decidida.");

  const estadoNuevo = decision === "Aprobada" ? "aprobada" : "rechazada";
  await prisma.novedadProyecto.update({
    where: { id_novedad },
    data: { estado: estadoNuevo, observacion_decision: observacion.trim(), decidido_por: usuarioQueConsulta.id_usuario, fecha_decision: new Date() },
  });

  if (decision === "Aprobada" && novedad.nombre_tipo === "Prórroga" && (novedad.tiempo_prorroga_meses ?? 0) > 0) {
    await regenerarPeriodos(id_proyecto, usuarioQueConsulta);
  }

  if (decision === "Aprobada" && novedad.participante_saliente) {
    // El saliente conserva su histórico: se marca inactivo en vez de borrarse.
    const saliente = proyecto.participantes.find((p) => `${p.rolProyecto.nombre} · ${nombreDe(p)}` === novedad.participante_saliente);
    if (saliente) {
      await prisma.usuarioProyecto.update({
        where: { id_usuarioproyecto: saliente.id_usuarioproyecto },
        data: { activo: false, fecha_desvinculacion: new Date() },
      });
    }
  }

  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

// ---------------------------------------------------------------------------
// M-06 Informe técnico final
// ---------------------------------------------------------------------------

type Ensamblado = Awaited<ReturnType<typeof ensamblar>>;

/** Crea la fila de InformeFinal (y sus cumplimientos en blanco, uno por objetivo real) la primera vez que
 * se toca este módulo — igual que PeriodoInforme/InformeAvance, el frontend lo trata como si siempre existiera. */
async function obtenerOCrearInformeFinal(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta) {
  let proyecto = await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  if (!proyecto.informesFinales[0]) {
    const creado = await prisma.informeFinal.create({ data: { id_proyecto, radicado_por: proyecto.creado_por } });
    await asegurarFirmas("informe_final", creado.id_informe_final, (rol) => resolverFirmanteProyecto(proyecto, rol));
    for (const objetivo of proyecto.objetivos) {
      await prisma.cumplimientoObjetivo.create({
        data: { id_informe_final: creado.id_informe_final, id_objetivo: objetivo.id_objetivo, descripcion_cumplimiento: "", cumplido: false },
      });
    }
    proyecto = await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  }
  return { proyecto, informeFinal: proyecto.informesFinales[0] };
}

/** Informes de avance que aún no están aprobados. */
function avancesSinAprobar(p: Ensamblado) {
  return p.periodos.filter((pe) => pe.estado !== "Aprobado");
}

/** El informe técnico final se habilita cuando todos los informes de avance están aprobados. Si el informe
 * ya tiene trabajo (devuelto, radicado, aprobado o con firmas) no se vuelve a bloquear. */
function informeFinalBloqueadoPorAvances(p: Ensamblado): boolean {
  const f = p.informe_final;
  if (f.estado !== "Borrador" || f.firmas.some((x) => x.firmado)) return false;
  return p.periodos.length === 0 || avancesSinAprobar(p).length > 0;
}

function mensajeBloqueoInformeFinal(p: Ensamblado): string {
  if (p.periodos.length === 0) {
    return "El informe final se desbloquea cuando se aprueben todos los informes de avance, y este proyecto aún no tiene periodos programados.";
  }
  const faltan = avancesSinAprobar(p).length;
  return `El informe final se desbloquea cuando se aprueben todos los informes de avance (${p.periodos.length - faltan} de ${p.periodos.length} aprobados).`;
}

/** El investigador solicita el informe final y el Administrador lo habilita (después de aprobados todos los avances).
 * Un informe que ya tiene firmas, radicado, devuelto o aprobado cuenta como habilitado. */
function informeFinalSinHabilitar(p: Ensamblado): boolean {
  const f = p.informe_final;
  if (f.estado !== "Borrador" || f.firmas.some((x) => x.firmado)) return false;
  return !f.fecha_habilitacion;
}

const MENSAJE_SIN_HABILITAR_INFORME_FINAL = "El Administrador debe habilitar el informe final antes de diligenciarlo.";

/** Solicitado por el investigador y a la espera de que el Administrador lo habilite. */
function informeFinalSolicitudPendiente(p: Ensamblado): boolean {
  return informeFinalSinHabilitar(p) && !!p.informe_final.fecha_solicitud && !informeFinalBloqueadoPorAvances(p);
}

function faltantesProducto(x: Ensamblado["productos"][number]): string[] {
  const faltan: string[] = [];
  if (x.obtenido === null) return x.proyectado > 0 ? ["cantidad obtenida"] : [];
  if (Math.max(0, x.obtenido - x.soportes.length) > 0) faltan.push("soporte");
  if (x.obtenido < x.proyectado && !x.observacion.trim()) faltan.push("observación");
  return faltan;
}

const soportesCompletos = (p: Ensamblado) => p.productos.every((x) => faltantesProducto(x).length === 0);

// El límite de palabras del resumen es configurable por el Administrador, pero solo en el
// módulo de "proyectos" (vía localStorage, aún no conectado a este backend) — 200 es el valor
// semilla con que arranca ese catálogo, así que es lo que se valida aquí.
const LIMITE_PALABRAS_RESUMEN = 200;
function contarPalabras(texto: string): number {
  const recortado = texto.trim();
  return recortado ? recortado.split(/\s+/).length : 0;
}

function informeListoParaFirmar(p: Ensamblado): string[] {
  const f = p.informe_final;
  const faltan: string[] = [];
  if (!f.info.area_conocimiento.trim() || !f.info.ciudad.trim() || !f.info.departamento.trim()) {
    faltan.push("Completa la información general: área de conocimiento, ciudad y departamento.");
  }
  if (!f.info.investigador_principal.correo.trim() || !f.info.investigador_principal.telefono.trim()) {
    faltan.push("Registra el correo y el teléfono del investigador principal.");
  }
  if (!f.resumen.trim()) faltan.push("Escribe el resumen del proyecto ejecutado.");
  else if (contarPalabras(f.resumen) > LIMITE_PALABRAS_RESUMEN) faltan.push(`El resumen no puede superar las ${LIMITE_PALABRAS_RESUMEN} palabras.`);
  if (f.objetivos.some((o) => !o.cumplimiento.trim())) faltan.push("Describe el cumplimiento de todos los objetivos.");
  if (!soportesCompletos(p)) faltan.push("Completa los resultados con sus soportes y observaciones.");
  return faltan;
}

/** POST /seguimiento/proyectos/:id/informe-final/solicitud */
export async function solicitarInformeFinal(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { proyecto, informeFinal } = await obtenerOCrearInformeFinal(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p));
  exigir(informeFinalSinHabilitar(p), "El informe final ya está habilitado.");
  exigir(!p.informe_final.fecha_solicitud, "El informe final ya fue solicitado.");
  await prisma.informeFinal.update({
    where: { id_informe_final: informeFinal.id_informe_final },
    data: { fecha_solicitud: new Date(), fecha_habilitacion: null, observacion_solicitud: "" },
  });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** PATCH /seguimiento/proyectos/:id/informe-final/solicitud */
export async function decidirSolicitudInformeFinal(
  id_proyecto: number,
  decision: "Habilitar" | "Rechazar",
  observacion: string,
  usuarioQueConsulta: UsuarioQueConsulta
) {
  const { proyecto, informeFinal } = await obtenerOCrearInformeFinal(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(informeFinalSolicitudPendiente(p), "El informe final no tiene una solicitud pendiente.");
  if (decision === "Habilitar") {
    await prisma.informeFinal.update({ where: { id_informe_final: informeFinal.id_informe_final }, data: { fecha_habilitacion: new Date(), observacion_solicitud: "" } });
  } else {
    exigir(observacion.trim(), "Indica el motivo del rechazo.");
    await prisma.informeFinal.update({ where: { id_informe_final: informeFinal.id_informe_final }, data: { fecha_solicitud: null, observacion_solicitud: observacion.trim() } });
  }
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

interface PersonaInformeEntrada {
  nombre: string;
  grupo: string;
  programa: string;
  correo: string;
  telefono: string;
}

export interface CambiosInformeFinal {
  info?: {
    area_conocimiento: string;
    ciudad: string;
    departamento: string;
    financiacion_externa: number;
    investigador_principal: PersonaInformeEntrada;
    co_investigador_interno: PersonaInformeEntrada;
    co_investigador_externo: PersonaInformeEntrada;
    apoyos: { nombre: string; tipo: "Auxiliar" | "Asistente"; codigo_estudiantil: string; correo: string }[];
  };
  resumen?: string;
  objetivos?: { titulo: string; descripcion: string; cumplido: boolean; cumplimiento: string }[];
  observaciones_objetivos?: string;
  equipos?: string[][];
  materiales?: string[][];
  actividades_apoyos?: string;
  evidencias_apoyos?: string;
  productos?: { obtenido: number | null; observacion: string; soportes: { tipo: "archivo" | "enlace"; archivo: string | null; url: string | null; descripcion: string }[] }[];
}

/** PUT /seguimiento/proyectos/:id/informe-final */
export async function guardarInformeFinal(id_proyecto: number, cambios: CambiosInformeFinal, usuarioQueConsulta: UsuarioQueConsulta) {
  const { proyecto, informeFinal } = await obtenerOCrearInformeFinal(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p));
  exigir(!informeFinalSinHabilitar(p), MENSAJE_SIN_HABILITAR_INFORME_FINAL);
  exigir(p.informe_final.estado === "Borrador" || p.informe_final.estado === "Devuelto", "El informe ya fue radicado y no se puede editar.");
  exigir(!p.informe_final.firmas.some((x) => x.firmado), "Ya hay firmas registradas: el informe no se puede modificar.");

  const datosScalar: Prisma.InformeFinalUpdateInput = {};
  if (cambios.info) {
    datosScalar.area_conocimiento = cambios.info.area_conocimiento;
    datosScalar.ciudad = cambios.info.ciudad;
    datosScalar.departamento = cambios.info.departamento;
    datosScalar.financiacion_externa = String(cambios.info.financiacion_externa ?? 0);
    datosScalar.apoyos = cambios.info.apoyos;
  }
  if (cambios.resumen !== undefined) datosScalar.resumen_ejecucion = cambios.resumen;
  if (cambios.observaciones_objetivos !== undefined) datosScalar.observaciones_objetivos = cambios.observaciones_objetivos;
  if (cambios.actividades_apoyos !== undefined) datosScalar.actividades_estudiantes = cambios.actividades_apoyos;
  if (cambios.evidencias_apoyos !== undefined) datosScalar.evidencias_estudiantes = cambios.evidencias_apoyos;
  if (Object.keys(datosScalar).length > 0) {
    await prisma.informeFinal.update({ where: { id_informe_final: informeFinal.id_informe_final }, data: datosScalar });
  }

  if (cambios.info) {
    const porRol: [string, PersonaInformeEntrada][] = [
      ["principal", cambios.info.investigador_principal],
      ["co_interno", cambios.info.co_investigador_interno],
      ["co_externo", cambios.info.co_investigador_externo],
    ];
    for (const [rol, persona] of porRol) {
      await prisma.informeFinalPersona.upsert({
        where: { id_informe_final_rol: { id_informe_final: informeFinal.id_informe_final, rol } },
        create: { id_informe_final: informeFinal.id_informe_final, rol, ...persona },
        update: { ...persona },
      });
    }
  }

  if (cambios.objetivos) {
    for (let i = 0; i < cambios.objetivos.length; i++) {
      const o = cambios.objetivos[i];
      const c = informeFinal.cumplimientos[i];
      if (!c) continue;
      await prisma.cumplimientoObjetivo.update({
        where: { id_cumplimiento: c.id_cumplimiento },
        data: { descripcion_cumplimiento: o.descripcion, cumplido: o.cumplido, observacion: o.cumplido ? null : o.cumplimiento },
      });
    }
  }

  if (cambios.equipos) {
    await prisma.equipoAdquirido.deleteMany({ where: { id_proyecto } });
    for (const [denominacion, fecha, estado, codigo, observaciones] of cambios.equipos) {
      if (!denominacion?.trim()) continue;
      await prisma.equipoAdquirido.create({
        data: { id_proyecto, denominacion, fecha_adquisicion: fecha ? new Date(fecha) : null, estado: estado || null, codigo_inventario: codigo || null, observaciones: observaciones || null },
      });
    }
  }
  if (cambios.materiales) {
    await prisma.materialBibliografico.deleteMany({ where: { id_proyecto } });
    for (const [nombre_material, fecha, isbn_issn, codigo, observaciones] of cambios.materiales) {
      if (!nombre_material?.trim()) continue;
      await prisma.materialBibliografico.create({
        data: { id_proyecto, nombre_material, fecha_adquisicion: fecha ? new Date(fecha) : null, isbn_issn: isbn_issn || null, codigo_inventario: codigo || null, observaciones: observaciones || null },
      });
    }
  }

  if (cambios.productos) {
    for (let i = 0; i < cambios.productos.length; i++) {
      const entrada = cambios.productos[i];
      const pp = proyecto.productos[i];
      if (!pp) continue;
      const existente = informeFinal.resultadosProductos.find((r) => r.id_proyecto_producto === pp.id_proyecto_producto);
      const datosResultado = { cantidad_proyectada: pp.cantidad, cantidad_obtenida: entrada.obtenido, observaciones: entrada.observacion };
      const resultado = existente
        ? await prisma.resultadoProducto.update({ where: { id_resultado_producto: existente.id_resultado_producto }, data: datosResultado })
        : await prisma.resultadoProducto.create({
            data: { id_proyecto_producto: pp.id_proyecto_producto, id_informe_final: informeFinal.id_informe_final, ...datosResultado },
          });
      await prisma.evidenciaResultadoProducto.deleteMany({ where: { id_resultado_producto: resultado.id_resultado_producto } });
      for (const s of entrada.soportes) {
        await prisma.evidenciaResultadoProducto.create({
          data: { id_resultado_producto: resultado.id_resultado_producto, tipo_evidencia: s.tipo, archivo: s.archivo, enlace: s.url, descripcion: s.descripcion },
        });
      }
    }
  }

  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** POST /seguimiento/proyectos/:id/informe-final/firmas/:indice */
export async function firmarInformeFinal(id_proyecto: number, indice: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { proyecto, informeFinal } = await obtenerOCrearInformeFinal(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p));
  exigir(!informeFinalSinHabilitar(p), MENSAJE_SIN_HABILITAR_INFORME_FINAL);
  const firmas = p.informe_final.firmas;
  const firma = firmas[indice];
  exigir(firma && !firma.firmado, "Esa firma ya está registrada.");
  if (ROLES_FIRMA_OPCIONAL.includes(firma.rol)) {
    exigir(firmaPrincipalLista(firmas), "Primero firma el investigador principal.");
  } else {
    const faltan = informeListoParaFirmar(p);
    exigir(faltan.length === 0, "El informe aún no está completo.", faltan);
    exigir(p.informe_final.estado === "Borrador" || p.informe_final.estado === "Devuelto", "El informe ya fue radicado.");
    exigirTurnoFirma(firmas, indice);
  }
  await marcarFirma("informe_final", informeFinal.id_informe_final, indice, usuarioQueConsulta);
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** POST /seguimiento/proyectos/:id/informe-final/radicar */
export async function radicarInformeFinal(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { proyecto, informeFinal } = await obtenerOCrearInformeFinal(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(!informeFinalBloqueadoPorAvances(p), mensajeBloqueoInformeFinal(p));
  exigir(!informeFinalSinHabilitar(p), MENSAJE_SIN_HABILITAR_INFORME_FINAL);
  exigir(firmasObligatoriasListas(p.informe_final.firmas), "Faltan las firmas del investigador principal y del líder para radicar el informe.");
  await prisma.informeFinal.update({
    where: { id_informe_final: informeFinal.id_informe_final },
    data: { estado: "radicado", fecha_radicacion: new Date(), observacion_revision: "" },
  });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** PATCH /seguimiento/proyectos/:id/informe-final/revision — una devolución borra las firmas. */
export async function revisarInformeFinal(
  id_proyecto: number,
  decision: "Aprobado" | "Devuelto",
  observacion: string,
  revisor: number,
  usuarioQueConsulta: UsuarioQueConsulta
) {
  const { informeFinal } = await obtenerOCrearInformeFinal(id_proyecto, usuarioQueConsulta);
  exigir(informeFinal.estado === "radicado", "Solo se revisan informes radicados.");
  exigir(decision === "Aprobado" || observacion.trim(), "Indica las observaciones de la devolución.");
  const estadoNuevo = decision === "Aprobado" ? "aprobado" : "devuelto";
  await prisma.informeFinal.update({
    where: { id_informe_final: informeFinal.id_informe_final },
    data: {
      estado: estadoNuevo,
      observacion_revision: decision === "Devuelto" ? observacion.trim() : "",
      revisado_por: decision === "Aprobado" ? revisor : null,
      fecha_revision: decision === "Aprobado" ? new Date() : null,
    },
  });
  if (decision === "Devuelto") await reabrirFirmas("informe_final", informeFinal.id_informe_final);
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

// ---------------------------------------------------------------------------
// M-07 Cierre y paz y salvo
// ---------------------------------------------------------------------------

/** Crea el acta de cierre (en blanco) la primera vez que se guarda — solo es posible cuando ya
 * existe un informe técnico final (puedeCerrar lo exige antes de llegar aquí). */
async function obtenerOCrearActaCierre(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta) {
  let proyecto = await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  const informeFinal = proyecto.informesFinales[0];
  if (informeFinal && !informeFinal.actasCierre[0]) {
    const creado = await prisma.actaCierre.create({
      data: { id_proyecto, id_informe_final: informeFinal.id_informe_final, generada_por: usuarioQueConsulta.id_usuario },
    });
    await asegurarFirmas("acta_cierre", creado.id_acta_cierre, (rol) => resolverFirmanteProyecto(proyecto, rol));
    proyecto = await obtenerProyectoCrudo(id_proyecto, usuarioQueConsulta);
  }
  return { proyecto, cierre: proyecto.informesFinales[0]?.actasCierre[0] };
}

interface Prerrequisito {
  titulo: string;
  ok: boolean;
  detalle: string;
}

function prerrequisitosCierre(p: Ensamblado): Prerrequisito[] {
  const aprobados = p.periodos.filter((x) => x.estado === "Aprobado").length;
  const informesOk = p.periodos.length > 0 && aprobados === p.periodos.length;
  const finalOk = p.informe_final.estado === "Aprobado";
  const soportesOk = soportesCompletos(p);
  return [
    {
      titulo: "Informes de avance aprobados",
      ok: informesOk,
      detalle: p.periodos.length ? `${aprobados} de ${p.periodos.length} periodos aprobados` : "No se han programado periodos",
    },
    { titulo: "Informe técnico final aprobado", ok: finalOk, detalle: finalOk ? "Informe aprobado por la Vicerrectoría" : `Estado actual: ${p.informe_final.estado}` },
    {
      titulo: "Soportes de productos completos",
      ok: soportesOk,
      detalle: soportesOk ? "Todos los productos reportados con soporte" : "Falta cantidad obtenida, enlace u observación en algún producto",
    },
  ];
}

const puedeCerrar = (p: Ensamblado) => prerrequisitosCierre(p).every((x) => x.ok);

/** Qué le falta al acta de cierre para poder firmarse; vacío = lista para firmar. */
function faltantesCierre(c: Ensamblado["cierre"]): string[] {
  const faltan: string[] = [];
  if (!c.fecha_fin_real) faltan.push("Fecha de finalización (numeral 1).");
  if (c.libros > 0 && !c.libros_soporte.trim()) faltan.push("Soporte de los libros reportados (numeral 2.1).");
  if (c.capitulos > 0 && !c.capitulos_soporte.trim()) faltan.push("Soporte de los capítulos de libro reportados (numeral 2.1).");
  if (!c.paz_y_salvo) faltan.push("Marcar la casilla «Declaro el paz y salvo de los investigadores».");
  if (!c.ciudad.trim()) faltan.push("Ciudad de suscripción.");
  if (!c.fecha_acta) faltan.push("Fecha del acta.");
  return faltan;
}

export interface CambiosCierre {
  linea_investigacion_principal?: string;
  linea_investigacion_co?: string;
  programas_estudiantes?: string[];
  libros?: number;
  libros_soporte?: string;
  libros_observacion?: string;
  capitulos?: number;
  capitulos_soporte?: string;
  capitulos_observacion?: string;
  fecha_fin_real?: string;
  paz_y_salvo?: boolean;
  ciudad?: string;
  fecha_acta?: string;
  observaciones?: string;
}

/** PUT /seguimiento/proyectos/:id/cierre */
export async function guardarCierre(id_proyecto: number, cambios: CambiosCierre, usuarioQueConsulta: UsuarioQueConsulta) {
  const { proyecto, cierre } = await obtenerOCrearActaCierre(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(puedeCerrar(p), "El cierre no está habilitado: hay prerrequisitos pendientes.");
  exigir(!p.cierre.firmas.some((x) => x.firmado), "Ya hay firmas registradas: los datos del cierre no se pueden modificar.");
  exigir(cierre, "No fue posible crear el acta de cierre.");

  const data: Prisma.ActaCierreUpdateInput = {};
  if (cambios.linea_investigacion_principal !== undefined) data.linea_investigacion_principal = cambios.linea_investigacion_principal;
  if (cambios.linea_investigacion_co !== undefined) data.linea_investigacion_co = cambios.linea_investigacion_co;
  if (cambios.programas_estudiantes !== undefined) data.programas_estudiantes = { set: cambios.programas_estudiantes };
  if (cambios.libros !== undefined) data.libros = cambios.libros;
  if (cambios.libros_soporte !== undefined) data.libros_soporte = cambios.libros_soporte;
  if (cambios.libros_observacion !== undefined) data.libros_observacion = cambios.libros_observacion;
  if (cambios.capitulos !== undefined) data.capitulos = cambios.capitulos;
  if (cambios.capitulos_soporte !== undefined) data.capitulos_soporte = cambios.capitulos_soporte;
  if (cambios.capitulos_observacion !== undefined) data.capitulos_observacion = cambios.capitulos_observacion;
  if (cambios.fecha_fin_real !== undefined) data.fecha_finalizacion_real = cambios.fecha_fin_real ? new Date(cambios.fecha_fin_real) : null;
  if (cambios.paz_y_salvo !== undefined) data.paz_y_salvo = cambios.paz_y_salvo;
  if (cambios.ciudad !== undefined) data.ciudad_firma = cambios.ciudad;
  if (cambios.fecha_acta !== undefined) data.fecha_acta = cambios.fecha_acta ? new Date(cambios.fecha_acta) : null;
  if (cambios.observaciones !== undefined) data.observaciones = cambios.observaciones;
  if (Object.keys(data).length > 0) {
    await prisma.actaCierre.update({ where: { id_acta_cierre: cierre.id_acta_cierre }, data });
  }
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** POST /seguimiento/proyectos/:id/cierre/firmas/:indice */
export async function firmarCierre(id_proyecto: number, indice: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { proyecto, cierre } = await obtenerOCrearActaCierre(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(puedeCerrar(p), "El cierre no está habilitado.");
  const faltan = faltantesCierre(p.cierre);
  exigir(faltan.length === 0, "Al acta de cierre le faltan datos.", faltan);
  exigir(cierre, "No fue posible crear el acta de cierre.");
  const firmas = p.cierre.firmas;
  const firma = firmas[indice];
  exigir(firma && !firma.firmado, "Esa firma ya está registrada.");
  if (ROLES_FIRMA_OPCIONAL.includes(firma.rol)) {
    exigir(firmaPrincipalLista(firmas), "Primero firma el investigador principal.");
  } else {
    exigirTurnoFirma(firmas, indice);
  }
  await marcarFirma("acta_cierre", cierre.id_acta_cierre, indice, usuarioQueConsulta);
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}

/** POST /seguimiento/proyectos/:id/cierre/finalizar */
export async function finalizarProyecto(id_proyecto: number, usuarioQueConsulta: UsuarioQueConsulta) {
  const { proyecto, cierre } = await obtenerOCrearActaCierre(id_proyecto, usuarioQueConsulta);
  const p = await ensamblar(proyecto);
  exigir(firmasObligatoriasListas(p.cierre.firmas), "Faltan firmas del acta de cierre.");
  exigir(cierre, "No fue posible crear el acta de cierre.");
  await prisma.actaCierre.update({ where: { id_acta_cierre: cierre.id_acta_cierre }, data: { estado: "cerrada" } });
  return obtenerProyectoSeguimiento(id_proyecto, usuarioQueConsulta);
}
