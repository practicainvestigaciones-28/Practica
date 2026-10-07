import { prisma } from "../config/prisma";

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

/**
 * Campos que el Líder diligencia directamente desde su vista de seguimiento
 * (no forman parte del registro que hace el investigador en CrearProyecto):
 * tipo de articulación, centro de costos, fechas y duración reales de
 * ejecución, y las dos columnas libres del reporte (evidencias/observaciones).
 */
export interface DatosSeguimientoProyecto {
  id_tipo_articulacion?: number | null;
  centro_costos?: string | null;
  fecha_inicio_real?: string | null;
  fecha_fin_real?: string | null;
  duracion_meses?: number | null;
  evidencias_resultados?: string | null;
  observaciones_resultados?: string | null;
}

const INCLUDE_PROYECTO_LIDER = {
  convocatoria: { select: { nombre: true } },
  modalidad: { select: { nombre: true } },
  tipoArticulacion: { select: { nombre: true } },
  financiacion: { select: { valor_total: true } },
  objetivos: { where: { tipo_objetivo: "general" }, select: { descripcion: true } },
  participantes: {
    select: {
      usuario: { select: { nombre: true, apellido: true } },
      nombre_manual: true,
      apellido_manual: true,
      rolProyecto: { select: { nombre: true } },
      rolEstudiante: { select: { nombre: true } },
    },
  },
  grupos: {
    select: {
      grupo: { select: { nombre: true } },
      lineaInvestigacion: { select: { nombre: true } },
    },
  },
  programas: {
    select: {
      programa_otro: true,
      programa: { select: { nombre: true } },
    },
  },
  productos: {
    select: {
      cantidad: true,
      cantidad_obtenida: true,
      tipoProducto: {
        select: {
          id_tipo_producto: true,
          nombre: true,
          subcategoria: { select: { nombre: true, categoria: { select: { nombre: true } } } },
        },
      },
    },
  },
} as const;

/**
 * RQF (seguimiento del líder VIE) - una fila por proyecto, con todo lo que
 * ya se registró al crear/evaluar el proyecto (título, objetivo, equipo,
 * grupo, modalidad, financiación, productos "proyectados"...) más lo que
 * el líder diligencia aparte (tipo de articulación, fechas reales,
 * centro de costos, "obtenido" por producto, evidencias/observaciones).
 * No filtra por estado: el líder necesita ver el portafolio completo.
 *
 * Sí filtra por GRUPO: un Líder de investigación solo debe ver los
 * proyectos vinculados al grupo de investigación que lidera (Grupo.id_lider,
 * asignado por el Administrador) — nunca el portafolio de otros grupos. El
 * Administrador, en cambio, usa esta misma pantalla/endpoint para ver TODO
 * sin filtrar (de ahí que esta ruta autorice ambos roles).
 */
export async function listarProyectosParaLider(usuarioQueConsulta: { id_usuario: number; roles: string[] }) {
  const esAdministrador = usuarioQueConsulta.roles.includes("Administrador");

  const proyectos = await prisma.proyecto.findMany({
    where: esAdministrador
      ? undefined
      : { grupos: { some: { grupo: { id_lider: usuarioQueConsulta.id_usuario } } } },
    include: INCLUDE_PROYECTO_LIDER,
    orderBy: { fecha_registro: "asc" },
  });

  return proyectos.map((p) => {
    const investigadorPrincipal = p.participantes.find(
      (part) => part.rolProyecto.nombre === "Investigador(a) Principal UNICESMAG"
    );
    const coInvestigadores = p.participantes.filter(
      (part) => part.rolProyecto.nombre !== "Investigador(a) Principal UNICESMAG" && part.rolProyecto.nombre !== "Estudiante Investigador(a)"
    );
    const estudiantes = p.participantes.filter((part) => part.rolProyecto.nombre === "Estudiante Investigador(a)");
    const egresados = p.participantes.filter((part) => part.rolProyecto.nombre === "Co investigador(a) Egresado(a) UNICESMAG");

    // Un participante sin cuenta real (ver participantes.service.ts) no tiene
    // `usuario` — su nombre queda en nombre_manual/apellido_manual.
    const nombreDe = (part: (typeof p.participantes)[number]) =>
      part.usuario
        ? `${part.usuario.nombre} ${part.usuario.apellido}`.trim()
        : `${part.nombre_manual ?? ""} ${part.apellido_manual ?? ""}`.trim();

    return {
      id_proyecto: p.id_proyecto,
      titulo: p.titulo,
      objetivo_general: p.objetivos[0]?.descripcion ?? null,
      convocatoria: p.convocatoria.nombre,
      modalidad: p.modalidad.nombre,
      id_tipo_articulacion: p.id_tipo_articulacion,
      tipo_articulacion: p.tipoArticulacion?.nombre ?? null,
      investigador_principal: investigadorPrincipal ? nombreDe(investigadorPrincipal) : null,
      co_investigadores: coInvestigadores.map(nombreDe),
      grupos: p.grupos.map((g) => g.grupo.nombre),
      lineas_investigacion: [...new Set(p.grupos.map((g) => g.lineaInvestigacion?.nombre).filter((n): n is string => !!n))],
      programas_academicos: p.programas.map((pr) => pr.programa?.nombre ?? pr.programa_otro).filter((n): n is string => !!n),
      duracion_periodos: p.duracion_periodos,
      duracion_meses: p.duracion_meses,
      fecha_inicio_real: p.fecha_inicio_real,
      fecha_fin_real: p.fecha_fin_real,
      valor_total: p.financiacion?.valor_total ?? null,
      num_estudiantes: estudiantes.length,
      num_egresados: egresados.length,
      centro_costos: p.centro_costos,
      estado_actual: p.estado_actual,
      evidencias_resultados: p.evidencias_resultados,
      observaciones_resultados: p.observaciones_resultados,
      productos: p.productos.map((pp) => ({
        id_tipo_producto: pp.tipoProducto.id_tipo_producto,
        nombre: pp.tipoProducto.nombre,
        subcategoria: pp.tipoProducto.subcategoria.nombre,
        categoria: pp.tipoProducto.subcategoria.categoria.nombre,
        proyectado: pp.cantidad,
        obtenido: pp.cantidad_obtenida,
      })),
    };
  });
}

/** Actualiza los campos de seguimiento que el líder diligencia sobre un proyecto ya registrado. */
export async function actualizarSeguimientoProyecto(id_proyecto: number, datos: DatosSeguimientoProyecto) {
  const existente = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!existente) throw new ProyectoNoEncontradoError();

  return prisma.proyecto.update({
    where: { id_proyecto },
    data: {
      id_tipo_articulacion: datos.id_tipo_articulacion,
      centro_costos: datos.centro_costos,
      fecha_inicio_real: datos.fecha_inicio_real ? new Date(datos.fecha_inicio_real) : datos.fecha_inicio_real,
      fecha_fin_real: datos.fecha_fin_real ? new Date(datos.fecha_fin_real) : datos.fecha_fin_real,
      duracion_meses: datos.duracion_meses,
      evidencias_resultados: datos.evidencias_resultados,
      observaciones_resultados: datos.observaciones_resultados,
    },
  });
}

/**
 * Registra cuánto se obtuvo de un tipo de producto en un proyecto. Si el
 * proyecto nunca lo proyectó (cantidad = 0), igual queda la fila creada: el
 * líder puede registrar un resultado que no estaba comprometido de entrada.
 */
export async function registrarProductoObtenido(id_proyecto: number, id_tipo_producto: number, cantidad_obtenida: number) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const tipoProducto = await prisma.tipoProducto.findUnique({ where: { id_tipo_producto } });
  if (!tipoProducto) throw new Error("El tipo de producto indicado no existe");

  return prisma.proyectoProducto.upsert({
    where: { id_proyecto_id_tipo_producto: { id_proyecto, id_tipo_producto } },
    update: { cantidad_obtenida },
    create: { id_proyecto, id_tipo_producto, cantidad: 0, cantidad_obtenida },
  });
}
