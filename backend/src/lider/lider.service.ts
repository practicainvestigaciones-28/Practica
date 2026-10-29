import { prisma } from "../config/prisma";
import { TIPO_NOTIFICACION } from "../notificaciones/notificaciones.service";

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

export class NoAutorizadoError extends Error {
  constructor() {
    super("Solo el líder del grupo de investigación al que está adscrito el proyecto puede darle el visto bueno o rechazarlo");
  }
}

export class ProyectoNoPendienteVistoBuenoError extends Error {
  constructor() {
    super("Este proyecto ya no está pendiente del visto bueno del líder");
  }
}

export class MotivoRechazoRequeridoError extends Error {
  constructor() {
    super("Debes explicar el motivo del rechazo: el investigador necesita saber qué corregir");
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

// El grupo de adscripción del proyecto es el PRIMER grupo CESMAG del
// formulario (ahí está el Investigador Principal); los externos no cuentan
// para el líder (ni se le muestran). Proyectos registrados antes de guardar
// el orden (todos en 0) caen al de menor id_proyecto_grupo.
const ORDEN_GRUPOS = [{ orden: "asc" as const }, { id_proyecto_grupo: "asc" as const }];
const GRUPO_INTERNO = { grupo: { tipoGrupo: { nombre: "interno" } } };

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
    where: GRUPO_INTERNO,
    orderBy: ORDEN_GRUPOS,
    select: {
      grupo: { select: { nombre: true, lineas_externas: true } },
      lineas: { select: { lineaInvestigacion: { select: { nombre: true } } } },
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
      : { grupos: { some: { grupo: { ...GRUPO_INTERNO.grupo, id_lider: usuarioQueConsulta.id_usuario } } } },
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
      lineas_investigacion: [
        ...new Set(
          p.grupos.flatMap((g) => [...g.lineas.map((l) => l.lineaInvestigacion.nombre), ...g.grupo.lineas_externas])
        ),
      ],
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

/**
 * Proyectos recién creados que esperan el visto bueno de ESTE líder (el
 * proyecto queda en "pendiente_lider" hasta que el líder de alguno de sus
 * grupos de investigación lo revise). Reemplaza la antigua "carta aval" en
 * papel: es el único paso real de aprobación del líder dentro del sistema.
 */
function liderDelGrupoPrincipal(grupos: { grupo: { id_lider: number | null } }[]): number | null {
  return grupos[0]?.grupo.id_lider ?? null;
}

export async function listarProyectosPendientesVistoBueno(id_usuario: number) {
  const candidatos = await prisma.proyecto.findMany({
    where: {
      estado_actual: "pendiente_lider",
      grupos: { some: { ...GRUPO_INTERNO, grupo: { ...GRUPO_INTERNO.grupo, id_lider: id_usuario } } },
    },
    select: {
      id_proyecto: true,
      titulo: true,
      fecha_registro: true,
      creador: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } },
      grupos: {
        where: GRUPO_INTERNO,
        orderBy: ORDEN_GRUPOS,
        select: { grupo: { select: { nombre: true, id_lider: true } } },
      },
    },
    orderBy: { fecha_registro: "asc" },
  });
  return candidatos
    .filter((p) => liderDelGrupoPrincipal(p.grupos) === id_usuario)
    .map(({ grupos, ...p }) => ({ ...p, grupos: grupos.slice(0, 1).map((g) => ({ grupo: { nombre: g.grupo.nombre } })) }));
}

async function verificarEsLiderDelProyecto(id_proyecto: number, id_usuario: number) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    include: { grupos: { where: GRUPO_INTERNO, orderBy: ORDEN_GRUPOS, include: { grupo: true } } },
  });
  if (!proyecto) throw new ProyectoNoEncontradoError();
  if (liderDelGrupoPrincipal(proyecto.grupos) !== id_usuario) throw new NoAutorizadoError();
  return proyecto;
}

/**
 * El líder da el visto bueno al proyecto: pasa a "pendiente", la misma
 * bandeja de Proyectos Postulados que antes veía el proyecto apenas se
 * registraba. Solo puede darlo el líder de alguno de los grupos del proyecto.
 */
export async function darVistoBuenoLider(id_proyecto: number, id_usuario: number) {
  const proyecto = await verificarEsLiderDelProyecto(id_proyecto, id_usuario);
  if (proyecto.estado_actual !== "pendiente_lider") throw new ProyectoNoPendienteVistoBuenoError();

  const etapaInicial = await prisma.etapa.findUnique({ where: { nombre: "General/Inicial" } });
  const estadoPendiente = await prisma.estado.findUnique({ where: { nombre: "pendiente" } });

  const administradores = await prisma.usuario.findMany({
    where: { activo: true, roles: { some: { rol: { nombre: "Administrador" } } } },
    select: { id_usuario: true },
  });

  const [actualizado] = await prisma.$transaction([
    prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "pendiente" } }),
    ...(etapaInicial && estadoPendiente
      ? [
          prisma.historialEtapaEstado.create({
            data: {
              id_proyecto,
              id_etapa: etapaInicial.id_etapa,
              id_estados: estadoPendiente.id_estado,
              cambiado_por: id_usuario,
              observacion: "El líder del grupo de investigación dio el visto bueno al proyecto.",
            },
          }),
        ]
      : []),
    ...administradores.map((admin) =>
      prisma.notificacion.create({
        data: {
          id_usuario: admin.id_usuario,
          titulo: "Proyecto con visto bueno del líder",
          mensaje: `El líder del grupo de investigación dio el visto bueno al proyecto "${proyecto.titulo}" — queda pendiente de revisión en Proyectos Postulados.`,
          enlace: `/proyectos`,
          rol_destino: "Administrador",
          tipo_evento: TIPO_NOTIFICACION.ADMIN_REVISAR_POSTULADO,
          id_proyecto,
        },
      })
    ),
  ]);

  return actualizado;
}

/**
 * El líder rechaza el proyecto antes de que llegue al Administrador. Reusa
 * el mismo estado "rechazado" que el rechazo inicial del Administrador
 * (ver rechazarProyectoInicial en evaluaciones.service.ts): el investigador
 * puede corregirlo y reenviarlo igual que en ese otro caso.
 */
export async function rechazarProyectoLider(id_proyecto: number, id_usuario: number, motivo: string) {
  if (!motivo?.trim()) throw new MotivoRechazoRequeridoError();

  const proyecto = await verificarEsLiderDelProyecto(id_proyecto, id_usuario);
  if (proyecto.estado_actual !== "pendiente_lider") throw new ProyectoNoPendienteVistoBuenoError();

  const etapaInicial = await prisma.etapa.findUnique({ where: { nombre: "General/Inicial" } });
  const estadoRechazado = await prisma.estado.findUnique({ where: { nombre: "rechazado" } });

  const mensajeInvestigador = `Tu proyecto "${proyecto.titulo}" fue rechazado por el líder del grupo de investigación. Motivo: ${motivo}`;

  const [actualizado] = await prisma.$transaction([
    prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "rechazado" } }),
    ...(etapaInicial && estadoRechazado
      ? [
          prisma.historialEtapaEstado.create({
            data: {
              id_proyecto,
              id_etapa: etapaInicial.id_etapa,
              id_estados: estadoRechazado.id_estado,
              cambiado_por: id_usuario,
              observacion: `Proyecto rechazado por el líder del grupo de investigación. Motivo: ${motivo}`,
            },
          }),
        ]
      : []),
    prisma.notificacion.create({
      data: {
        id_usuario: proyecto.creado_por,
        titulo: "Tu proyecto fue rechazado",
        mensaje: mensajeInvestigador,
        enlace: `/proyectos/ver/${id_proyecto}`,
        rol_destino: "Investigador",
        tipo_evento: TIPO_NOTIFICACION.INVESTIGADOR_CORREGIR,
        id_proyecto,
      },
    }),
  ]);

  return actualizado;
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
