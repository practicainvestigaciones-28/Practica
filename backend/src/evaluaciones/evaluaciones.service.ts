import { prisma } from "../config/prisma";

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

export class EtapaNoEncontradaError extends Error {
  constructor() {
    super("La etapa indicada no existe");
  }
}

export class EstadoNoEncontradoError extends Error {
  constructor() {
    super("El estado indicado no existe en el catálogo. Contacta al administrador del sistema");
  }
}

export class AsignacionYaExisteError extends Error {
  constructor() {
    super("El proyecto ya tiene una asignación pendiente en esta etapa");
  }
}

export class EvaluadorRequeridoError extends Error {
  constructor() {
    super(
      "Debes indicar el integrante del comité que revisará el proyecto: cada proyecto se asigna a una persona concreta, no al comité como bloque"
    );
  }
}

export class EvaluadorNoValidoError extends Error {
  constructor() {
    super("El usuario indicado como evaluador no existe o está inactivo");
  }
}

export class NoEsElEvaluadorAsignadoError extends Error {
  constructor() {
    super("Solo el integrante al que se le asignó este proyecto puede evaluarlo");
  }
}

export class SinAsignacionAbiertaError extends Error {
  constructor() {
    super("El proyecto no tiene una revisión abierta en esta etapa");
  }
}

export class SinCorreccionesPendientesError extends Error {
  constructor() {
    super("El proyecto no tiene correcciones pendientes por reenviar en esta etapa");
  }
}

export class NoEsAutorDelProyectoError extends Error {
  constructor() {
    super("Solo quien registró el proyecto puede reenviarlo tras corregir");
  }
}

const RESULTADOS_VALIDOS = [
  "aprobado",
  "aprobado_con_correcciones",
  "rechazado",
  "no_cumple",
] as const;
export type ResultadoEvaluacion = (typeof RESULTADOS_VALIDOS)[number];

export class ResultadoInvalidoError extends Error {
  constructor() {
    super(`resultado debe ser uno de: ${RESULTADOS_VALIDOS.join(", ")}`);
  }
}

/** Busca un estado del catálogo por nombre. Los nombres vienen sembrados (ver seed.ts). */
async function obtenerEstadoPorNombre(nombre: string) {
  const estado = await prisma.estado.findUnique({ where: { nombre } });
  if (!estado) throw new EstadoNoEncontradoError();
  return estado;
}

/** RQF58 (parametrización) - Catálogo de estados posibles de una evaluación/etapa. */
export async function listarEstados() {
  return prisma.estado.findMany({ orderBy: { id_estado: "asc" } });
}

/** RQF58 (parametrización) - Qué etapa sigue a cuál, para saber a dónde avanza un proyecto aprobado. */
export async function listarTransicionesEtapa() {
  return prisma.transicionEtapa.findMany({
    include: { etapaOrigen: true, etapaDestino: true },
    orderBy: { id_transicion: "asc" },
  });
}

export interface FiltrosAsignaciones {
  id_etapa?: number;
  asignado_a?: number;
  /** true = solo las que todavía no tienen fecha_finalizacion (bandeja de pendientes) */
  pendientes?: boolean;
}

/** Bandeja de trabajo: qué proyectos están pendientes de revisión, por etapa/evaluador. */
export async function listarAsignaciones(filtros: FiltrosAsignaciones) {
  return prisma.asignacionRevision.findMany({
    where: {
      ...(filtros.id_etapa ? { id_etapa: filtros.id_etapa } : {}),
      ...(filtros.asignado_a ? { asignado_a: filtros.asignado_a } : {}),
      ...(filtros.pendientes ? { fecha_finalizacion: null } : {}),
    },
    include: {
      proyecto: { select: { id_proyecto: true, titulo: true, estado_actual: true } },
      etapa: true,
      estado: true,
      asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_asignacion: "desc" },
  });
}

export interface DatosAsignacion {
  /**
   * Integrante del comité que revisará ESTE proyecto. Es obligatorio: aunque
   * el comité tenga varios integrantes, cada proyecto lo revisa una sola
   * persona (un mismo integrante sí puede llevar varios proyectos). Sin esto
   * la asignación quedaría a nombre del comité entero y no aparecería en la
   * bandeja de nadie.
   */
  asignado_a: number;
  fecha_limite?: Date;
}

/**
 * RQF44 - El Administrador acepta el proyecto (ya validó su documentación
 * inicial) y lo asigna a una etapa de evaluación (Comité de Investigación,
 * Ética, Pares). No se exige que la etapa destino sea "la siguiente" según
 * TransicionEtapa: esta es la puerta de entrada manual del flujo (desde
 * General/Inicial no existe todavía ninguna AsignacionRevision previa de la
 * que derivar una etapa "actual"), así que se confía en que el Administrador
 * elige la etapa correcta. TransicionEtapa quedó solo como catálogo de
 * consulta (qué etapa suele seguir a cuál): ninguna etapa avanza sola, ver
 * la nota sobre el RQF48 en registrarEvaluacion.
 */
export async function asignarProyectoAEtapa(
  id_proyecto: number,
  id_etapa: number,
  asignado_por: number,
  datos: DatosAsignacion
) {
  if (!datos.asignado_a) throw new EvaluadorRequeridoError();

  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

  const evaluador = await prisma.usuario.findUnique({
    where: { id_usuario: datos.asignado_a },
    select: { id_usuario: true, activo: true },
  });
  if (!evaluador || !evaluador.activo) throw new EvaluadorNoValidoError();

  const asignacionAbierta = await prisma.asignacionRevision.findFirst({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null },
  });
  if (asignacionAbierta) throw new AsignacionYaExisteError();

  const estadoPendiente = await obtenerEstadoPorNombre("pendiente");

  const [asignacion] = await prisma.$transaction([
    prisma.asignacionRevision.create({
      data: {
        id_proyecto,
        id_etapa,
        id_estado: estadoPendiente.id_estado,
        asignado_a: datos.asignado_a,
        asignado_por,
        fecha_limite: datos.fecha_limite,
      },
      include: {
        etapa: true,
        estado: true,
        asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
      },
    }),
    prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "pendiente" } }),
    prisma.historialEtapaEstado.create({
      data: {
        id_proyecto,
        id_etapa,
        id_estados: estadoPendiente.id_estado,
        cambiado_por: asignado_por,
        observacion: `Proyecto asignado a la etapa "${etapa.nombre}"`,
      },
    }),
  ]);

  return asignacion;
}

export interface DatosEvaluacion {
  evaluado_por: number;
  resultado: ResultadoEvaluacion;
  comentarios?: string;
  puntaje?: number;
  formato_evaluacion?: string;
}

/**
 * RQF45/49/57 - Registra el resultado de la evaluación de una etapa (comité
 * de investigación, ética, pares). Cierra la asignación pendiente de esa
 * etapa y actualiza el estado consolidado del proyecto.
 *
 * Solo puede firmar la evaluación el integrante que tiene la asignación
 * abierta: es quien revisó el proyecto y quien, si pide correcciones, tendrá
 * que validarlas después (ver reenviarCorrecciones / validarCorrecciones).
 *
 * DESVIACIÓN DELIBERADA DEL RQF48: el requisito pide que al aprobar una etapa
 * el proyecto se envíe automáticamente a la siguiente. No es posible tal
 * cual: cada etapa la revisa una PERSONA concreta del comité correspondiente
 * y el sistema no tiene cómo decidir a cuál de los integrantes le toca. Un
 * envío automático crearía una asignación sin responsable, invisible en
 * cualquier bandeja. Por eso ninguna etapa avanza sola: al cerrarse una, el
 * proyecto queda "listo para asignar" (ver obtenerEstadoConsolidado) y el
 * Administrador elige etapa e integrante desde su vista de proyectos.
 */
export async function registrarEvaluacion(
  id_proyecto: number,
  id_etapa: number,
  datos: DatosEvaluacion
) {
  if (!RESULTADOS_VALIDOS.includes(datos.resultado)) throw new ResultadoInvalidoError();

  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

  // La evaluación la firma quien tiene la revisión abierta, no cualquier
  // administrador: es la persona a la que se le asignó este proyecto.
  const asignacion = await prisma.asignacionRevision.findFirst({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null },
  });
  if (!asignacion) throw new SinAsignacionAbiertaError();
  if (asignacion.asignado_a !== datos.evaluado_por) throw new NoEsElEvaluadorAsignadoError();

  const estadoResultado = await obtenerEstadoPorNombre(datos.resultado);

  const [evaluacion] = await prisma.$transaction([
    prisma.evaluacionEtapa.create({
      data: {
        id_proyecto,
        id_etapa,
        evaluado_por: datos.evaluado_por,
        resultado: estadoResultado.id_estado,
        comentarios: datos.comentarios,
        puntaje: datos.puntaje,
        formato_evaluacion: datos.formato_evaluacion,
      },
      include: { etapa: true, estado: true },
    }),
    prisma.asignacionRevision.update({
      where: { id_asignacion: asignacion.id_asignacion },
      data: { fecha_finalizacion: new Date() },
    }),
    prisma.proyecto.update({
      where: { id_proyecto },
      // El estado consolidado refleja siempre el resultado real de la etapa
      // que acaba de cerrarse. Que el proyecto siga o no a otra etapa es una
      // decisión posterior del Administrador, no un efecto de esta llamada.
      data: { estado_actual: datos.resultado },
    }),
    prisma.historialEtapaEstado.create({
      data: {
        id_proyecto,
        id_etapa,
        id_estados: estadoResultado.id_estado,
        cambiado_por: datos.evaluado_por,
        observacion: `Evaluación de "${etapa.nombre}": ${datos.resultado}`,
      },
    }),
  ]);

  return evaluacion;
}

/**
 * RQF46 - El investigador reenvía el proyecto después de aplicar las
 * correcciones que le pidió el comité. Reabre la revisión de esa etapa con el
 * MISMO integrante que las pidió: él conoce el caso y es quien debe verificar
 * que quedaron subsanadas.
 *
 * Hace falta un paso explícito porque al pedir correcciones la asignación se
 * cierra (la pelota pasa al investigador). Sin este reenvío no existiría
 * ninguna revisión abierta contra la cual validarCorrecciones() pudiera
 * actuar, y el proyecto quedaría trabado.
 */
export async function reenviarCorrecciones(
  id_proyecto: number,
  id_etapa: number,
  id_usuario: number
) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();
  if (proyecto.creado_por !== id_usuario) throw new NoEsAutorDelProyectoError();

  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

  const abierta = await prisma.asignacionRevision.findFirst({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null },
  });
  if (abierta) throw new AsignacionYaExisteError();

  // La última evaluación de la etapa tiene que haber pedido correcciones; de
  // ella sale también el integrante que debe revisar el reenvío.
  const ultimaEvaluacion = await prisma.evaluacionEtapa.findFirst({
    where: { id_proyecto, id_etapa },
    include: { estado: true },
    orderBy: { fecha_evaluacion: "desc" },
  });
  if (ultimaEvaluacion?.estado.nombre !== "aprobado_con_correcciones") {
    throw new SinCorreccionesPendientesError();
  }

  const estadoRevision = await obtenerEstadoPorNombre("revision");

  const [asignacion] = await prisma.$transaction([
    prisma.asignacionRevision.create({
      data: {
        id_proyecto,
        id_etapa,
        id_estado: estadoRevision.id_estado,
        asignado_a: ultimaEvaluacion.evaluado_por,
        asignado_por: id_usuario,
      },
      include: {
        etapa: true,
        estado: true,
        asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
      },
    }),
    prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "revision" } }),
    prisma.historialEtapaEstado.create({
      data: {
        id_proyecto,
        id_etapa,
        id_estados: estadoRevision.id_estado,
        cambiado_por: id_usuario,
        observacion: `El investigador reenvió el proyecto corregido en "${etapa.nombre}"`,
      },
    }),
  ]);

  return asignacion;
}

export interface DatosCorreccion {
  evaluado_por: number;
  aprobadas: boolean;
  comentarios?: string;
}

/**
 * RQF47 - El MISMO integrante que pidió las correcciones valida si el reenvío
 * del investigador subsana lo solicitado. Es una reevaluación de la misma
 * etapa: si aprueba, la etapa queda cerrada en "aprobado" y el proyecto pasa
 * a "listo para asignar"; si no, vuelve a "aprobado_con_correcciones" y el
 * investigador tendrá que reenviar de nuevo.
 *
 * Requiere una revisión abierta, así que el investigador debe haber reenviado
 * antes con reenviarCorrecciones().
 */
export async function validarCorrecciones(
  id_proyecto: number,
  id_etapa: number,
  datos: DatosCorreccion
) {
  return registrarEvaluacion(id_proyecto, id_etapa, {
    evaluado_por: datos.evaluado_por,
    resultado: datos.aprobadas ? "aprobado" : "aprobado_con_correcciones",
    comentarios: datos.comentarios,
  });
}

/**
 * RQF61 - Consolidación del estado global del proyecto. Reúne en una sola
 * respuesta dónde está parado el proyecto dentro del flujo institucional:
 * en qué etapa, con qué estado, si está esperando correcciones del
 * investigador, qué dijo cada comité, y qué etapa vendría después.
 *
 * Es de SOLO LECTURA: no reescribe `Proyecto.estado_actual` ni marca el
 * proyecto como finalizado al terminar las etapas de evaluación — después
 * de esto viene la etapa de seguimiento, así que cerrar el proyecto aquí
 * sería adelantarse al flujo real.
 */
export async function obtenerEstadoConsolidado(id_proyecto: number) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    select: { id_proyecto: true, titulo: true, estado_actual: true, fecha_registro: true },
  });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  // La etapa "actual" es la de la asignación que sigue abierta. Si no hay
  // ninguna abierta, el proyecto no está esperando a nadie: se toma la
  // última etapa por la que pasó (según el historial) como la etapa donde
  // quedó parado.
  const asignacionAbierta = await prisma.asignacionRevision.findFirst({
    where: { id_proyecto, fecha_finalizacion: null },
    include: {
      etapa: true,
      estado: true,
      asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_asignacion: "desc" },
  });

  const ultimoHistorial = await prisma.historialEtapaEstado.findFirst({
    where: { id_proyecto },
    include: { etapa: true, estado: true },
    orderBy: { fecha_cambio: "desc" },
  });

  const etapaActual = asignacionAbierta?.etapa ?? ultimoHistorial?.etapa ?? null;
  const estadoActual = asignacionAbierta?.estado ?? ultimoHistorial?.estado ?? null;

  const evaluaciones = await prisma.evaluacionEtapa.findMany({
    where: { id_proyecto },
    include: {
      etapa: true,
      estado: true,
      evaluadoPor: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_evaluacion: "asc" },
  });

  // Espera correcciones si la última evaluación pidió correcciones y nadie
  // ha vuelto a abrir una revisión después (es decir, la pelota está del
  // lado del investigador, no del comité).
  const ultimaEvaluacion = evaluaciones.at(-1) ?? null;
  const esperaCorrecciones =
    ultimaEvaluacion?.estado.nombre === "aprobado_con_correcciones" && !asignacionAbierta;

  const siguienteTransicion = etapaActual
    ? await prisma.transicionEtapa.findFirst({
        where: { id_etapa_origen: etapaActual.id_etapa },
        include: { etapaDestino: true },
      })
    : null;

  // El proyecto espera que el Administrador lo mande a la siguiente etapa:
  // aprobó donde estaba, nadie lo está revisando ahora y no hay correcciones
  // pendientes. Es la señal que usa la vista de administración para ofrecer
  // el botón de asignar, ya que ninguna etapa avanza sola (ver RQF48 en
  // registrarEvaluacion).
  const listoParaAsignar =
    !asignacionAbierta &&
    !esperaCorrecciones &&
    ultimaEvaluacion?.estado.nombre === "aprobado" &&
    siguienteTransicion !== null;

  return {
    proyecto,
    etapa_actual: etapaActual,
    estado_actual: estadoActual,
    /** true = el comité ya se pronunció y ahora le toca al investigador corregir */
    espera_correcciones: esperaCorrecciones,
    /** true = hay una revisión abierta esperando el pronunciamiento del comité */
    en_revision: asignacionAbierta !== null,
    /** true = aprobó la etapa y espera que el Administrador lo asigne a la siguiente */
    listo_para_asignar: listoParaAsignar,
    asignacion_abierta: asignacionAbierta,
    /**
     * Etapa que SUELE seguir a la actual, según el catálogo TransicionEtapa.
     * Es una sugerencia para la vista de administración: el proyecto no avanza
     * hasta que el Administrador lo asigne explícitamente a un integrante.
     */
    siguiente_etapa: siguienteTransicion?.etapaDestino ?? null,
    etapas_evaluadas: evaluaciones.map((e) => ({
      etapa: e.etapa,
      resultado: e.estado,
      comentarios: e.comentarios,
      evaluado_por: e.evaluadoPor,
      fecha_evaluacion: e.fecha_evaluacion,
    })),
  };
}

/** RQF59 - Historial automático de cambios de etapa/estado de un proyecto. */
export async function listarHistorialProyecto(id_proyecto: number) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  return prisma.historialEtapaEstado.findMany({
    where: { id_proyecto },
    include: {
      etapa: true,
      estado: true,
      cambiadoPor: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_cambio: "asc" },
  });
}
