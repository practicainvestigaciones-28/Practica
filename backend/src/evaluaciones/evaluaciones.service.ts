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
  asignado_a?: number;
  fecha_limite?: Date;
}

/**
 * RQF44 - El Administrador acepta el proyecto (ya validó su documentación
 * inicial) y lo asigna a una etapa de evaluación (Comité de Investigación,
 * Ética, Pares). No se exige que la etapa destino sea "la siguiente" según
 * TransicionEtapa: esta es la puerta de entrada manual del flujo (desde
 * General/Inicial no existe todavía ninguna AsignacionRevision previa de la
 * que derivar una etapa "actual"), así que se confía en que el Administrador
 * elige la etapa correcta. TransicionEtapa sí se usa, y de forma estricta,
 * para el AVANCE AUTOMÁTICO dentro de registrarEvaluacion.
 */
export async function asignarProyectoAEtapa(
  id_proyecto: number,
  id_etapa: number,
  asignado_por: number,
  datos: DatosAsignacion = {}
) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

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
 * RQF48 - Si el resultado es "aprobado", en la MISMA transacción se busca la
 * siguiente etapa en TransicionEtapa y, si existe, se crea automáticamente
 * la nueva AsignacionRevision ahí (envío automático a Ética, por ejemplo).
 * "aprobado_con_correcciones", "rechazado" y "no_cumple" no avanzan solos:
 * el primero espera a que el investigador corrija (ver validarCorrecciones),
 * los otros dos cierran el proceso en esa etapa.
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

  const estadoResultado = await obtenerEstadoPorNombre(datos.resultado);

  // Si aprueba, se resuelve de una vez a qué etapa sigue (si la hay) para
  // poder incluir el envío automático dentro de la misma transacción.
  let siguienteEtapa: { id_etapa: number; nombre: string } | null = null;
  let estadoPendiente: { id_estado: number } | null = null;
  if (datos.resultado === "aprobado") {
    const transicion = await prisma.transicionEtapa.findFirst({
      where: { id_etapa_origen: id_etapa },
      include: { etapaDestino: true },
    });
    if (transicion) {
      siguienteEtapa = transicion.etapaDestino;
      estadoPendiente = await obtenerEstadoPorNombre("pendiente");
    }
  }

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
    prisma.asignacionRevision.updateMany({
      where: { id_proyecto, id_etapa, fecha_finalizacion: null },
      data: { fecha_finalizacion: new Date() },
    }),
    prisma.proyecto.update({
      where: { id_proyecto },
      // Si avanza solo a la siguiente etapa, el estado consolidado vuelve a
      // "pendiente" (pendiente ahí); si no hay siguiente etapa, refleja el
      // resultado tal cual (aprobado/rechazado/etc. queda como final).
      data: { estado_actual: siguienteEtapa ? "pendiente" : datos.resultado },
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
    ...(siguienteEtapa && estadoPendiente
      ? [
          prisma.asignacionRevision.create({
            data: {
              id_proyecto,
              id_etapa: siguienteEtapa.id_etapa,
              id_estado: estadoPendiente.id_estado,
              asignado_por: datos.evaluado_por,
            },
          }),
          prisma.historialEtapaEstado.create({
            data: {
              id_proyecto,
              id_etapa: siguienteEtapa.id_etapa,
              id_estados: estadoPendiente.id_estado,
              cambiado_por: datos.evaluado_por,
              observacion: `Envío automático a "${siguienteEtapa.nombre}" tras aprobación de "${etapa.nombre}"`,
            },
          }),
        ]
      : []),
  ]);

  return evaluacion;
}

export interface DatosCorreccion {
  evaluado_por: number;
  aprobadas: boolean;
  comentarios?: string;
}

/**
 * RQF47 - El comité valida si las correcciones que reenvió el investigador
 * subsanan lo solicitado. Es una reevaluación de la misma etapa: si se
 * aprueban, se comporta exactamente igual que una evaluación "aprobado"
 * (incluido el envío automático a la siguiente etapa); si no, el proyecto
 * queda otra vez en "aprobado_con_correcciones" a la espera de un nuevo
 * reenvío.
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
