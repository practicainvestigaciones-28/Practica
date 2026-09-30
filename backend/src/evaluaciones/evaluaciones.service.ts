import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { validarProductosObligatorios } from "../productos/productos.service";
import { crearNotificacion } from "../notificaciones/notificaciones.service";

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

export class AsignacionSinAbrirError extends Error {
  constructor() {
    super("Este proyecto no está enviado a esta etapa todavía. El Administrador debe aceptarlo primero desde Proyectos Postulados");
  }
}


/**
 * RQF44 (control de completitud) - Un proyecto no puede entrar a ninguna
 * etapa de evaluación si le falta información: el comité no debería revisar
 * un proyecto sin objetivos, sin financiación o sin documentos cargados. La
 * lista de `faltantes` usa el nombre de cada sección tal como la conoce el
 * frontend (participantes, areas_conocimiento, etc.), no el nombre de tabla.
 */
export class ProyectoIncompletoError extends Error {
  constructor(public readonly faltantes: string[]) {
    super(`El proyecto no está completo para enviarlo a evaluación. Falta: ${faltantes.join(", ")}`);
  }
}

/**
 * Qué rol debe tener quien revisa cada etapa. Va como constante y no como
 * columna de Etapa porque las etapas son un catálogo fijo sembrado en
 * seed.ts: sumar una etapa nueva es un cambio de modelo, no de datos.
 *
 * "General/Inicial" no aparece a propósito: no la revisa ningún comité, es la
 * validación documental que hace el propio Administrador (RQF39).
 */
const ROL_POR_ETAPA: Record<string, string> = {
  Comite_Investigacion: "Comité de Investigación",
  Etica: "Comité de Ética",
  Pares: "Par Evaluador",
};

/**
 * Cuántos evaluadores puede tener abiertos a la vez un mismo proyecto en
 * cada etapa. Comités de Investigación y Ética revisan con un solo
 * integrante; Pares admite 2 (HU-25: "asignar dos pares por proyecto para
 * garantizar doble evaluación"). Cada evaluador cierra su propia fila de
 * AsignacionRevision de forma independiente al evaluar (ver
 * registrarEvaluacion), así que 2 pares pueden estar en momentos distintos
 * del proceso sin pisarse.
 */
const MAX_EVALUADORES_POR_ETAPA: Record<string, number> = {
  Comite_Investigacion: 1,
  Etica: 1,
  Pares: 2,
};

function maxEvaluadoresDe(nombreEtapa: string): number {
  return MAX_EVALUADORES_POR_ETAPA[nombreEtapa] ?? 1;
}

export class EvaluadorNoValidoParaEtapaError extends Error {
  constructor(rolRequerido: string, etapa: string) {
    super(`Para revisar la etapa "${etapa}" el usuario debe tener el rol "${rolRequerido}"`);
  }
}

export class LimiteEvaluadoresError extends Error {
  constructor(etapa: string, max: number) {
    super(`La etapa "${etapa}" admite máximo ${max} evaluador${max === 1 ? "" : "es"} por proyecto`);
  }
}

export class EvaluadorDuplicadoError extends Error {
  constructor() {
    super("No puedes indicar al mismo evaluador más de una vez");
  }
}

export class SinResponsableError extends Error {
  constructor() {
    super("Selecciona al menos un evaluador");
  }
}

/**
 * RQF54/HU-29 - Un Par Evaluador no puede llevar más de esta cantidad de
 * proyectos activos (asignaciones sin evaluar todavía) al mismo tiempo, para
 * controlar su carga laboral. Solo aplica al rol Par Evaluador: los comités
 * no tienen este límite en los requisitos.
 */
const MAX_PROYECTOS_POR_PAR_EVALUADOR = 3;

export class LimiteProyectosPorParError extends Error {
  constructor(nombreEvaluador: string, max: number) {
    super(`${nombreEvaluador} ya tiene ${max} proyectos activos como Par Evaluador. Debe terminar alguno antes de recibir uno nuevo`);
  }
}

export class PuntajeRequeridoError extends Error {
  constructor() {
    super('El puntaje de la rúbrica es obligatorio para evaluar la etapa "Pares"');
  }
}

export class SinResultadoPendienteError extends Error {
  constructor() {
    super("Este proyecto no tiene una calificación de Pares pendiente de enviar");
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
      proyecto: {
        select: {
          id_proyecto: true,
          titulo: true,
          estado_actual: true,
          creador: { select: { id_usuario: true, nombre: true, apellido: true } },
          convocatoria: { select: { id_convocatoria: true, nombre: true } },
        },
      },
      etapa: true,
      estado: true,
      asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_asignacion: "desc" },
  });
}

/**
 * Bandeja de proyectos postulados del Administrador: los que todavía no han
 * entrado a ninguna etapa de evaluación. Es la lista sobre la que el
 * Administrador entra al detalle del proyecto y decide a qué etapa y a qué
 * integrante lo asigna.
 */
export async function listarProyectosPostulados() {
  return prisma.proyecto.findMany({
    where: { asignacionesRevision: { none: {} } },
    select: {
      id_proyecto: true,
      titulo: true,
      estado_actual: true,
      fecha_registro: true,
      creador: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } },
      convocatoria: { select: { id_convocatoria: true, nombre: true } },
      modalidad: { select: { id_modalidad: true, nombre: true } },
      _count: { select: { documentos: true, participantes: true } },
    },
    orderBy: { fecha_registro: "asc" },
  });
}

export interface DatosAsignacion {
  /**
   * Integrante del comité que revisará ESTE proyecto. Opcional en esta
   * llamada: si no viene, el proyecto queda "listo para asignar" (visible en
   * el panel de Asignaciones) hasta que el Administrador elija responsable
   * ahí con asignarResponsable(). Aunque el comité tenga varios integrantes,
   * cada proyecto lo revisa una sola persona (un mismo integrante sí puede
   * llevar varios proyectos) — sin responsable la asignación no aparecería
   * en la bandeja de nadie.
   */
  asignado_a?: number;
  fecha_limite?: Date;
}

/**
 * Comprueba que el proyecto tenga diligenciadas todas las secciones del
 * registro (participantes, área, programa, financiación, grupo, objetivos,
 * antecedentes, cronograma, al menos un documento cargado y los productos
 * obligatorios del catálogo — ver RQF31) antes de dejarlo entrar a
 * cualquier etapa de evaluación.
 */
async function verificarProyectoCompletoParaEvaluacion(id_proyecto: number): Promise<void> {
  const [
    participantes,
    areas,
    programas,
    financiacion,
    grupos,
    objetivos,
    antecedentes,
    cronograma,
    documentos,
    validacionProductos,
  ] = await Promise.all([
    prisma.usuarioProyecto.count({ where: { id_proyecto } }),
    prisma.proyectoArea.count({ where: { id_proyectos: id_proyecto } }),
    prisma.proyectoPrograma.count({ where: { id_proyectos: id_proyecto } }),
    prisma.financiacion.findUnique({ where: { id_proyecto } }),
    prisma.proyectoGrupo.count({ where: { id_proyecto } }),
    prisma.objetivo.count({ where: { id_proyecto } }),
    prisma.antecedente.count({ where: { id_proyecto } }),
    prisma.cronogramaActividad.count({ where: { id_proyecto } }),
    prisma.proyectoDocumento.count({ where: { id_proyecto } }),
    validarProductosObligatorios(id_proyecto),
  ]);

  const faltantes: string[] = [];
  if (participantes === 0) faltantes.push("participantes");
  if (areas === 0) faltantes.push("areas_conocimiento");
  if (programas === 0) faltantes.push("programas_academicos");
  if (!financiacion) faltantes.push("financiacion");
  if (grupos === 0) faltantes.push("grupos_investigacion");
  if (objetivos === 0) faltantes.push("objetivos");
  if (antecedentes === 0) faltantes.push("antecedentes");
  if (cronograma === 0) faltantes.push("cronograma");
  if (documentos === 0) faltantes.push("documentos");
  if (!validacionProductos.cumple) faltantes.push("productos_obligatorios");

  if (faltantes.length > 0) throw new ProyectoIncompletoError(faltantes);
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
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

  await verificarProyectoCompletoParaEvaluacion(id_proyecto);

  // RQF44 - Validar evaluador solo si se proporciona asignado_a
  // Si no viene, el proyecto queda "listo para asignar" sin responsable aún
  if (datos.asignado_a) {
    const evaluador = await prisma.usuario.findUnique({
      where: { id_usuario: datos.asignado_a },
      select: {
        id_usuario: true,
        activo: true,
        roles: { select: { rol: { select: { nombre: true, estado: true } } } },
      },
    });
    if (!evaluador || !evaluador.activo) throw new EvaluadorNoValidoError();

    // No basta con que exista: tiene que pertenecer al comité de ESTA etapa.
    // Sin esto un integrante de Ética podría recibir una revisión de Pares.
    const rolRequerido = ROL_POR_ETAPA[etapa.nombre];
    if (rolRequerido) {
      const perteneceAlComite = evaluador.roles.some(
        (r) => r.rol.nombre === rolRequerido && r.rol.estado
      );
      if (!perteneceAlComite) throw new EvaluadorNoValidoParaEtapaError(rolRequerido, etapa.nombre);
    }
  }

  const abiertas = await prisma.asignacionRevision.count({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null },
  });
  if (abiertas >= maxEvaluadoresDe(etapa.nombre)) throw new AsignacionYaExisteError();

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
    // "revision": una vez asignado a una etapa deja de estar "pendiente" de
    // envío (que es lo que el Admin usa para filtrar Proyectos Postulados).
    prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "revision" } }),
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

/**
 * Rechaza un proyecto todavía en "General/Inicial" (revisión inicial del
 * Administrador, antes de enviarlo a cualquier comité). No pasa por
 * AsignacionRevision/EvaluacionEtapa a propósito: esa etapa no tiene un
 * integrante de comité asignado (ver nota sobre ROL_POR_ETAPA), así que
 * registrarEvaluacion no aplica aquí — solo actualiza el estado del proyecto
 * y deja un registro en el historial con el motivo.
 */
export async function rechazarProyectoInicial(id_proyecto: number, cambiado_por: number, motivo?: string) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const etapaInicial = await prisma.etapa.findUnique({ where: { nombre: "General/Inicial" } });
  if (!etapaInicial) throw new EtapaNoEncontradaError();

  const estadoRechazado = await obtenerEstadoPorNombre("rechazado");

  const [actualizado] = await prisma.$transaction([
    prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "rechazado" } }),
    prisma.historialEtapaEstado.create({
      data: {
        id_proyecto,
        id_etapa: etapaInicial.id_etapa,
        id_estados: estadoRechazado.id_estado,
        cambiado_por,
        observacion: motivo
          ? `Proyecto rechazado en la revisión inicial. Motivo: ${motivo}`
          : "Proyecto rechazado en la revisión inicial.",
      },
    }),
  ]);

  return actualizado;
}

/**
 * RQF44/50 - Asigna (o reasigna) el conjunto de responsables de la revisión
 * que el Administrador ya abrió desde Proyectos Postulados ("Aceptar y
 * enviar a Comité"). Es un paso separado de asignarProyectoAEtapa a
 * propósito: esa función no puede volver a llamarse para el mismo
 * proyecto+etapa una vez lleno el cupo (ver AsignacionYaExisteError) — este
 * es el único camino para completarla, desde el panel de Asignaciones.
 *
 * Recibe la lista completa de evaluadores que debe quedar asignada (no una
 * lista para "agregar"): a quien ya estaba y sigue en la lista lo deja
 * igual, a quien se quita le limpia el responsable de su fila (sin borrar
 * la fila, para no perder la auditoría/fecha_asignacion original), y a quien
 * se agrega le reutiliza una fila libre o le crea una nueva. Así el
 * Administrador puede reemplazar a alguien saturado sin pasos adicionales,
 * y en Pares puede tener a los dos evaluadores simultáneamente.
 */
export async function asignarResponsables(id_proyecto: number, id_etapa: number, asignado_por: number, evaluadores: number[]) {
  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

  const idsUnicos = [...new Set(evaluadores)];
  if (idsUnicos.length === 0) throw new SinResponsableError();
  if (idsUnicos.length !== evaluadores.length) throw new EvaluadorDuplicadoError();

  const maxEvaluadores = maxEvaluadoresDe(etapa.nombre);
  if (idsUnicos.length > maxEvaluadores) throw new LimiteEvaluadoresError(etapa.nombre, maxEvaluadores);

  const abiertas = await prisma.asignacionRevision.findMany({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null },
  });
  if (abiertas.length === 0) throw new AsignacionSinAbrirError();

  const idsActuales = new Set(abiertas.filter((a) => a.asignado_a !== null).map((a) => a.asignado_a as number));
  // Solo a quien realmente se está incorporando (no a quien ya estaba) se le
  // valida rol/carga: alguien que ya tenía este proyecto no debería quedar
  // bloqueado por su propio cupo al simplemente confirmarlo de nuevo.
  const aAgregar = idsUnicos.filter((id) => !idsActuales.has(id));
  // Filas reutilizables: las que ya estaban sin responsable, o las de quien se está quitando.
  const filasLibres = abiertas.filter((a) => a.asignado_a === null || !idsUnicos.includes(a.asignado_a));

  const rolRequerido = ROL_POR_ETAPA[etapa.nombre];
  for (const idUsuario of aAgregar) {
    const evaluador = await prisma.usuario.findUnique({
      where: { id_usuario: idUsuario },
      select: {
        id_usuario: true,
        nombre: true,
        apellido: true,
        activo: true,
        roles: { select: { rol: { select: { nombre: true, estado: true } } } },
      },
    });
    if (!evaluador || !evaluador.activo) throw new EvaluadorNoValidoError();

    // No basta con que exista: tiene que pertenecer al comité de ESTA etapa.
    // Sin esto un integrante de Ética podría recibir una revisión de Pares.
    if (rolRequerido) {
      const perteneceAlComite = evaluador.roles.some((r) => r.rol.nombre === rolRequerido && r.rol.estado);
      if (!perteneceAlComite) throw new EvaluadorNoValidoParaEtapaError(rolRequerido, etapa.nombre);
    }

    if (rolRequerido === "Par Evaluador") {
      const proyectosActivos = await prisma.asignacionRevision.count({
        where: {
          asignado_a: idUsuario,
          fecha_finalizacion: null,
          id_proyecto: { not: id_proyecto },
          etapa: { nombre: "Pares" },
        },
      });
      if (proyectosActivos >= MAX_PROYECTOS_POR_PAR_EVALUADOR) {
        throw new LimiteProyectosPorParError(`${evaluador.nombre} ${evaluador.apellido}`, MAX_PROYECTOS_POR_PAR_EVALUADOR);
      }
    }
  }

  const operaciones: Prisma.PrismaPromise<unknown>[] = [];
  for (let i = 0; i < aAgregar.length; i++) {
    const filaLibre = filasLibres[i];
    if (filaLibre) {
      operaciones.push(
        prisma.asignacionRevision.update({ where: { id_asignacion: filaLibre.id_asignacion }, data: { asignado_a: aAgregar[i] } })
      );
    } else {
      operaciones.push(
        prisma.asignacionRevision.create({
          data: { id_proyecto, id_etapa, id_estado: abiertas[0].id_estado, asignado_a: aAgregar[i], asignado_por },
        })
      );
    }
  }
  // Filas libres que no hicieron falta para los nuevos (se redujo el número
  // de evaluadores): quedan sin responsable, no se borran.
  for (const filaSobrante of filasLibres.slice(aAgregar.length)) {
    if (filaSobrante.asignado_a !== null) {
      operaciones.push(prisma.asignacionRevision.update({ where: { id_asignacion: filaSobrante.id_asignacion }, data: { asignado_a: null } }));
    }
  }

  await prisma.$transaction(operaciones);

  return prisma.asignacionRevision.findMany({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null },
    include: {
      proyecto: { select: { id_proyecto: true, titulo: true, estado_actual: true } },
      etapa: true,
      estado: true,
      asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
  });
}

export interface DatosEvaluacion {
  evaluado_por: number;
  resultado: ResultadoEvaluacion;
  comentarios?: string;
  puntaje?: number;
  formato_evaluacion?: string;
}

/**
 * RQF48 (revisado) - Si TransicionEtapa define una etapa siguiente a
 * `id_etapa` y todavía no hay una asignación abierta ahí, arma las
 * operaciones para abrirla SIN responsable (el sistema no decide a cuál
 * integrante del comité de destino le toca). Se usa tanto al aprobar en una
 * sola firma (comités) como al consolidar el promedio de Pares.
 */
async function construirOperacionesAvanceAutomatico(
  id_proyecto: number,
  id_etapa: number,
  nombreEtapaOrigen: string,
  asignado_por: number
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const transicion = await prisma.transicionEtapa.findFirst({
    where: { id_etapa_origen: id_etapa },
    include: { etapaDestino: true },
  });
  if (!transicion) return [];

  // Defensivo: no debería existir ya una asignación abierta en la etapa
  // destino, pero si por algún motivo la hay, no se duplica.
  const yaAbiertaEnDestino = await prisma.asignacionRevision.findFirst({
    where: { id_proyecto, id_etapa: transicion.id_etapa_destino, fecha_finalizacion: null },
  });
  if (yaAbiertaEnDestino) return [];

  const estadoPendiente = await obtenerEstadoPorNombre("pendiente");
  // Comité de Ética tiene 1 día para revisar desde que el proyecto le llega
  // (recién aprobado por la etapa anterior).
  const fechaLimite =
    transicion.etapaDestino.nombre === "Etica" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined;
  return [
    prisma.asignacionRevision.create({
      data: {
        id_proyecto,
        id_etapa: transicion.id_etapa_destino,
        id_estado: estadoPendiente.id_estado,
        asignado_por,
        fecha_limite: fechaLimite,
      },
    }),
    prisma.historialEtapaEstado.create({
      data: {
        id_proyecto,
        id_etapa: transicion.id_etapa_destino,
        id_estados: estadoPendiente.id_estado,
        cambiado_por: asignado_por,
        observacion: `Proyecto avanzó automáticamente a la etapa "${transicion.etapaDestino.nombre}" tras la aprobación de "${nombreEtapaOrigen}". Pendiente de asignar integrante.`,
      },
    }),
  ];
}

/**
 * true si una evaluación "aprobado" de Comité de Investigación es en
 * realidad la validación de una corrección pedida DESPUÉS de que el
 * proyecto ya pasó por Pares (ver reenviarCorrecciones): ahí el ciclo
 * institucional ya terminó (opción confirmada con el usuario: no se repite
 * Ética ni Pares), así que ni debe auto-avanzar ni debe seguir
 * ofreciéndose como "listo para asignar" a la siguiente etapa.
 */
async function esValidacionPostPares(id_proyecto: number, nombreEtapa: string): Promise<boolean> {
  if (nombreEtapa !== "Comite_Investigacion") return false;
  const yaEvaluoPares = await prisma.evaluacionEtapa.findFirst({
    where: { id_proyecto, etapa: { nombre: "Pares" } },
  });
  return yaEvaluoPares !== null;
}

/**
 * RQF52 - Calcula (sin aplicar nada) el promedio de los puntajes de Pares
 * para esta etapa: toma el registro más reciente de CADA evaluador (por si
 * alguno reenvió/corrigió), y arma tanto el promedio como el resultado que
 * se aplicaría según la escala oficial del formato institucional
 * "008-Evaluación proyecto de investigación" (rúbrica de 90 puntos):
 * 80-90 aprueba sin ajustes, 70-79 aprueba con ajustes, menos de 70 no
 * aprueba. Es de solo lectura: lo usan tanto la vista previa para el
 * Administrador (obtenerCalificacionesParesPendientes) como el envío real
 * (enviarResultadoPares).
 */
async function calcularPromedioPares(id_proyecto: number, id_etapa: number) {
  const evaluaciones = await prisma.evaluacionEtapa.findMany({
    where: { id_proyecto, id_etapa },
    include: { evaluadoPor: { select: { id_usuario: true, nombre: true, apellido: true } } },
    orderBy: { fecha_evaluacion: "desc" },
  });

  // Si un par reenvió/corrigió, puede tener más de un registro: se toma solo
  // el más reciente de cada evaluador (la lista ya viene ordenada desc).
  const masRecientePorEvaluador = new Map<number, (typeof evaluaciones)[number]>();
  for (const ev of evaluaciones) {
    if (!masRecientePorEvaluador.has(ev.evaluado_por)) masRecientePorEvaluador.set(ev.evaluado_por, ev);
  }
  const evaluacionesConsideradas = [...masRecientePorEvaluador.values()];

  const puntajes = evaluacionesConsideradas
    .map((ev) => ev.puntaje)
    .filter((p): p is Prisma.Decimal => p !== null)
    .map((p) => p.toNumber());

  const promedio = puntajes.length > 0 ? puntajes.reduce((suma, p) => suma + p, 0) / puntajes.length : null;
  const resultadoSugerido: ResultadoEvaluacion | null =
    promedio === null ? null : promedio >= 80 ? "aprobado" : promedio >= 70 ? "aprobado_con_correcciones" : "rechazado";

  return { evaluacionesConsideradas, promedio, resultadoSugerido };
}

/**
 * Para la vista del Administrador: qué calificó cada par y el promedio que
 * se aplicaría si se envía. No cambia nada en la base — es solo lectura,
 * hasta que el Administrador confirme con enviarResultadoPares().
 */
export async function obtenerCalificacionesParesPendientes(id_proyecto: number, id_etapa: number) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();
  if (proyecto.estado_actual !== "pares_pendiente_envio") throw new SinResultadoPendienteError();

  const { evaluacionesConsideradas, promedio, resultadoSugerido } = await calcularPromedioPares(id_proyecto, id_etapa);

  return {
    proyecto: { id_proyecto: proyecto.id_proyecto, titulo: proyecto.titulo },
    calificaciones: evaluacionesConsideradas.map((ev) => ({
      evaluador: ev.evaluadoPor,
      puntaje: ev.puntaje?.toNumber() ?? null,
      comentarios: ev.comentarios,
      fecha_evaluacion: ev.fecha_evaluacion,
    })),
    promedio,
    resultado_sugerido: resultadoSugerido,
  };
}

/**
 * RQF53/HU-28 - El Administrador revisa las calificaciones individuales de
 * los pares (obtenerCalificacionesParesPendientes) y, cuando está de
 * acuerdo, envía el resultado: recién ahí se aplica el promedio, se
 * actualiza el estado del proyecto y se notifica al investigador (con las
 * observaciones de cada par, si las hay). Ningún par decide esto por sí
 * solo, y tampoco se aplica solo con que ambos terminen de evaluar — hace
 * falta esta confirmación explícita del Administrador.
 */
export async function enviarResultadoPares(id_proyecto: number, id_etapa: number, enviado_por: number) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();
  if (proyecto.estado_actual !== "pares_pendiente_envio") throw new SinResultadoPendienteError();

  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa) throw new EtapaNoEncontradaError();

  const { evaluacionesConsideradas, promedio, resultadoSugerido } = await calcularPromedioPares(id_proyecto, id_etapa);
  if (promedio === null || resultadoSugerido === null) throw new SinResultadoPendienteError();

  const estadoFinal = await obtenerEstadoPorNombre(resultadoSugerido);

  const operaciones: Prisma.PrismaPromise<unknown>[] = [
    prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: resultadoSugerido } }),
    prisma.historialEtapaEstado.create({
      data: {
        id_proyecto,
        id_etapa,
        id_estados: estadoFinal.id_estado,
        cambiado_por: enviado_por,
        observacion: `El Administrador envió el resultado de "${etapa.nombre}" (${evaluacionesConsideradas.length} evaluador${evaluacionesConsideradas.length === 1 ? "" : "es"}): promedio ${promedio.toFixed(1)} → ${resultadoSugerido}`,
      },
    }),
  ];

  if (resultadoSugerido === "aprobado") {
    operaciones.push(...(await construirOperacionesAvanceAutomatico(id_proyecto, id_etapa, etapa.nombre, enviado_por)));
  }

  await prisma.$transaction(operaciones);

  const observacionesTexto = evaluacionesConsideradas
    .filter((ev) => ev.comentarios?.trim())
    .map((ev, i) => `Par ${i + 1}: ${ev.comentarios}`)
    .join("\n");

  const mensajePorResultado: Record<ResultadoEvaluacion, string> = {
    aprobado: `Tu proyecto "${proyecto.titulo}" fue aprobado por los pares evaluadores sin necesidad de ajustes (promedio: ${promedio.toFixed(1)}).`,
    aprobado_con_correcciones: `Tu proyecto "${proyecto.titulo}" fue aprobado por los pares evaluadores con ajustes (promedio: ${promedio.toFixed(1)}). Debes corregirlo según las observaciones y reenviarlo.`,
    rechazado: `Tu proyecto "${proyecto.titulo}" no fue aprobado por los pares evaluadores (promedio: ${promedio.toFixed(1)}).`,
    no_cumple: `Tu proyecto "${proyecto.titulo}" no cumple los requisitos según los pares evaluadores (promedio: ${promedio.toFixed(1)}).`,
  };

  await crearNotificacion(proyecto.creado_por, {
    titulo: "Resultado de la evaluación por pares",
    mensaje: observacionesTexto ? `${mensajePorResultado[resultadoSugerido]}\n\n${observacionesTexto}` : mensajePorResultado[resultadoSugerido],
  });

  return { promedio, resultado: resultadoSugerido };
}

/** Para la pantalla del Administrador: proyectos con calificación de Pares lista para revisar y enviar. */
export async function listarProyectosConCalificacionPendiente() {
  return prisma.proyecto.findMany({
    where: { estado_actual: "pares_pendiente_envio" },
    select: {
      id_proyecto: true,
      titulo: true,
      fecha_registro: true,
      creador: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_registro: "asc" },
  });
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
 * RQF48 (revisado) - Al aprobar una etapa, si TransicionEtapa define una
 * etapa siguiente, se abre automáticamente su asignación — pero, igual que
 * en asignarProyectoAEtapa, SIN responsable: el sistema no decide a cuál
 * integrante del comité de destino le toca. Esto ya no es "invisible en
 * ninguna bandeja" (la razón por la que antes se había quitado por completo
 * el autoenvío): toda asignación sin responsable aparece en el panel de
 * Asignaciones, así que el Administrador solo tiene que elegir integrante,
 * no volver a enviar el proyecto manualmente etapa por etapa.
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
  // administrador: es la persona a la que se le asignó este proyecto. Con
  // varios evaluadores posibles en la misma etapa (Pares), cada uno cierra
  // únicamente su propia fila — la del otro evaluador sigue abierta.
  const abiertas = await prisma.asignacionRevision.findMany({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null },
  });
  if (abiertas.length === 0) throw new SinAsignacionAbiertaError();
  const asignacion = abiertas.find((a) => a.asignado_a === datos.evaluado_por);
  if (!asignacion) throw new NoEsElEvaluadorAsignadoError();

  // RQF52 - En Pares el resultado del proyecto no lo decide cada par por su
  // cuenta: lo decide el promedio de sus puntajes (ver consolidarResultadoPares),
  // así que el puntaje individual es obligatorio para poder calcularlo.
  const esEtapaPares = etapa.nombre === "Pares";
  if (esEtapaPares && (datos.puntaje === undefined || datos.puntaje === null)) {
    throw new PuntajeRequeridoError();
  }

  const estadoResultado = await obtenerEstadoPorNombre(datos.resultado);

  // El investigador tiene 2 días para reenviar el proyecto corregido cuando
  // el comité pide correcciones (ver reenviarCorrecciones).
  const fechaLimiteCorreccion =
    datos.resultado === "aprobado_con_correcciones"
      ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      : undefined;

  const operaciones: Prisma.PrismaPromise<unknown>[] = [
    prisma.evaluacionEtapa.create({
      data: {
        id_proyecto,
        id_etapa,
        evaluado_por: datos.evaluado_por,
        resultado: estadoResultado.id_estado,
        comentarios: datos.comentarios,
        puntaje: datos.puntaje,
        formato_evaluacion: datos.formato_evaluacion,
        fecha_limite_correccion: fechaLimiteCorreccion,
      },
      include: { etapa: true, estado: true },
    }),
    prisma.asignacionRevision.update({
      where: { id_asignacion: asignacion.id_asignacion },
      data: { fecha_finalizacion: new Date() },
    }),
  ];

  if (esEtapaPares) {
    // No se toca estado_actual ni se avanza de etapa todavía: falta ver si
    // hay otro par con su revisión abierta. Queda solo el registro de la
    // opinión individual de este evaluador en el historial.
    operaciones.push(
      prisma.historialEtapaEstado.create({
        data: {
          id_proyecto,
          id_etapa,
          id_estados: estadoResultado.id_estado,
          cambiado_por: datos.evaluado_por,
          observacion: `Evaluación individual de "${etapa.nombre}" (puntaje ${datos.puntaje}): ${datos.resultado}`,
        },
      })
    );
  } else {
    // Comités: un solo evaluador, su resultado ES el resultado del proyecto.
    operaciones.push(
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
      })
    );

    if (datos.resultado === "aprobado" && !(await esValidacionPostPares(id_proyecto, etapa.nombre))) {
      operaciones.push(...(await construirOperacionesAvanceAutomatico(id_proyecto, id_etapa, etapa.nombre, datos.evaluado_por)));
    }
  }

  const [evaluacion] = await prisma.$transaction(operaciones);

  if (esEtapaPares) {
    // ¿Queda algún otro par con su revisión todavía abierta? Si no, ya
    // terminaron todos — pero el promedio NO se aplica solo: queda
    // "pendiente de envío" hasta que el Administrador revise las
    // calificaciones individuales (obtenerCalificacionesParesPendientes) y
    // confirme con enviarResultadoPares().
    const siguenAbiertas = await prisma.asignacionRevision.count({
      where: { id_proyecto, id_etapa, fecha_finalizacion: null },
    });
    if (siguenAbiertas === 0) {
      await prisma.$transaction([
        prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "pares_pendiente_envio" } }),
        prisma.historialEtapaEstado.create({
          data: {
            id_proyecto,
            id_etapa,
            id_estados: estadoResultado.id_estado,
            cambiado_por: datos.evaluado_por,
            observacion: `Todos los evaluadores de "${etapa.nombre}" terminaron. Pendiente de que el Administrador revise las calificaciones y envíe el resultado.`,
          },
        }),
      ]);
    }
  }

  return evaluacion;
}

/**
 * RQF46 - El investigador reenvía el proyecto después de aplicar las
 * correcciones que le pidió el comité (o el promedio de Pares). En comités
 * reabre la revisión de esa etapa con el MISMO integrante que las pidió: él
 * conoce el caso y es quien debe verificar que quedaron subsanadas.
 *
 * En Pares el reenvío NO vuelve a los mismos pares: como los ajustes ya
 * fueron pedidos con base en 2 evaluaciones independientes y el proyecto ya
 * pasó por Comité de Investigación y Ética antes, se considera que los
 * cambios son puntuales. Por eso el reenvío se manda directo a Comité de
 * Investigación (sin responsable todavía, como cualquier asignación nueva)
 * para que el Administrador revise los cambios y decida — ahí termina el
 * ciclo, no se vuelve a pasar por Ética ni por Pares.
 *
 * Hace falta un paso explícito porque al pedir correcciones la asignación se
 * cierra (la pelota pasa al investigador). Sin este reenvío no existiría
 * ninguna revisión abierta contra la cual validarCorrecciones() (comités) o
 * el Administrador (Pares) pudieran actuar, y el proyecto quedaría trabado.
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

  // El estado CONSOLIDADO del proyecto es quien decide si hay correcciones
  // pendientes, no la última fila individual de EvaluacionEtapa: en comités
  // coinciden siempre (un solo evaluador), pero en Pares el resultado real
  // es el promedio (ver enviarResultadoPares), que puede no coincidir con
  // lo que puso el último par en evaluar.
  if (proyecto.estado_actual !== "aprobado_con_correcciones") {
    throw new SinCorreccionesPendientesError();
  }

  if (etapa.nombre === "Pares") {
    const etapaComiteInvestigacion = await prisma.etapa.findUniqueOrThrow({ where: { nombre: "Comite_Investigacion" } });

    const yaAbierta = await prisma.asignacionRevision.findFirst({
      where: { id_proyecto, id_etapa: etapaComiteInvestigacion.id_etapa, fecha_finalizacion: null },
    });
    if (yaAbierta) throw new AsignacionYaExisteError();

    const estadoPendiente = await obtenerEstadoPorNombre("pendiente");

    const [asignacion] = await prisma.$transaction([
      prisma.asignacionRevision.create({
        data: { id_proyecto, id_etapa: etapaComiteInvestigacion.id_etapa, id_estado: estadoPendiente.id_estado, asignado_por: id_usuario },
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
          id_etapa: etapaComiteInvestigacion.id_etapa,
          id_estados: estadoPendiente.id_estado,
          cambiado_por: id_usuario,
          observacion: `El investigador reenvió el proyecto corregido tras la evaluación de Pares. Reasignado a Comité de Investigación para validar los cambios, pendiente de asignar integrante.`,
        },
      }),
    ]);

    return [asignacion];
  }

  // Comités: quién debe volver a revisar el reenvío es quien pidió las
  // correcciones (un solo evaluador en esta etapa).
  const evaluaciones = await prisma.evaluacionEtapa.findMany({
    where: { id_proyecto, id_etapa },
    orderBy: { fecha_evaluacion: "desc" },
  });
  const evaluadoresPorRevisar = [...new Map(evaluaciones.map((e) => [e.evaluado_por, e])).keys()];
  if (evaluadoresPorRevisar.length === 0) throw new SinCorreccionesPendientesError();

  // Ninguno de ellos debería tener ya una revisión abierta en esta etapa.
  const yaAbiertaParaAlguno = await prisma.asignacionRevision.findFirst({
    where: { id_proyecto, id_etapa, fecha_finalizacion: null, asignado_a: { in: evaluadoresPorRevisar } },
  });
  if (yaAbiertaParaAlguno) throw new AsignacionYaExisteError();

  const estadoRevision = await obtenerEstadoPorNombre("revision");

  const resultado = await prisma.$transaction([
    ...evaluadoresPorRevisar.map((asignado_a) =>
      prisma.asignacionRevision.create({
        data: { id_proyecto, id_etapa, id_estado: estadoRevision.id_estado, asignado_a, asignado_por: id_usuario },
        include: {
          etapa: true,
          estado: true,
          asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
        },
      })
    ),
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

  // Las primeras N entradas del resultado son las asignaciones creadas (una
  // por evaluador); las últimas 2 son el update de proyecto y el historial.
  return resultado.slice(0, evaluadoresPorRevisar.length);
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
  // quedó parado. Puede haber más de una abierta a la vez (Pares admite 2
  // evaluadores simultáneos) — todas comparten etapa/estado, así que basta
  // con la primera para esos dos campos, pero se expone la lista completa
  // en `asignaciones_abiertas` para quien necesite ver a cada evaluador.
  const asignacionesAbiertas = await prisma.asignacionRevision.findMany({
    where: { id_proyecto, fecha_finalizacion: null },
    include: {
      etapa: true,
      estado: true,
      asignadoA: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_asignacion: "desc" },
  });
  const asignacionAbierta = asignacionesAbiertas[0] ?? null;

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

  // Espera correcciones si el proyecto quedó en "aprobado_con_correcciones" y
  // nadie ha vuelto a abrir una revisión después (la pelota está del lado
  // del investigador, no del comité). Se compara contra el ESTADO
  // CONSOLIDADO del proyecto, no contra la última fila de EvaluacionEtapa:
  // en comités coinciden siempre (un solo evaluador), pero en Pares el
  // resultado real es el promedio (ver consolidarResultadoPares), que puede
  // no coincidir con lo que puso el último par en evaluar individualmente.
  const esperaCorrecciones = proyecto.estado_actual === "aprobado_con_correcciones" && !asignacionAbierta;

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
  // registrarEvaluacion). No aplica si esta aprobación es la validación
  // final de una corrección post-Pares (ver esValidacionPostPares): ahí el
  // ciclo ya terminó, no hay "siguiente etapa" real que ofrecer.
  const listoParaAsignar =
    !asignacionAbierta &&
    !esperaCorrecciones &&
    proyecto.estado_actual === "aprobado" &&
    siguienteTransicion !== null &&
    !(etapaActual && (await esValidacionPostPares(id_proyecto, etapaActual.nombre)));

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
    /** true = ambos pares ya evaluaron; falta que el Administrador revise y envíe el resultado (ver enviarResultadoPares) */
    resultado_pares_pendiente: proyecto.estado_actual === "pares_pendiente_envio",
    asignacion_abierta: asignacionAbierta,
    /** Todas las asignaciones abiertas de la etapa actual (más de una en etapas con varios evaluadores, como Pares). */
    asignaciones_abiertas: asignacionesAbiertas,
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
      fecha_limite_correccion: e.fecha_limite_correccion,
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
