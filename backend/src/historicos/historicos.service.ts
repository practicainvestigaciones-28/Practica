/**
 * Proyectos anteriores al sistema, ya terminados: el Administrador los carga con su acta de inicio, informes de avance,
 * informe final y acta de cierre. No pasan por firmas, líder, comités ni pares: todo queda en su estado terminal
 * (acta legalizada, informes aprobados, acta de cierre cerrada) y no se crea ninguna firma ni notificación.
 */
import { prisma } from "../config/prisma";
import { MESES_POR_PERIODO, SEMANAS_POR_PERIODO, restarUnDia, sumarMeses } from "../seguimiento/seguimiento.service";

export class ProyectoHistoricoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

export class ProyectoNoHistoricoError extends Error {
  constructor() {
    super("Solo un proyecto cargado como finalizado puede recibir su seguimiento histórico");
  }
}

export class SeguimientoHistoricoYaRegistradoError extends Error {
  constructor() {
    super("Este proyecto ya tiene su seguimiento histórico registrado");
  }
}

export class DatosHistoricosInvalidosError extends Error {}

export interface DatosInformeAvanceHistorico {
  numero_periodo: number;
  fecha_radicacion?: Date;
  porcentaje_avance?: number;
  observaciones_generales?: string;
  /** Por actividad del cronograma del proyecto; las que no vengan quedan "no iniciada". */
  actividades?: { id_actividad: number; estado_actividad?: string; porcentaje_cumplimiento?: number; observacion?: string }[];
}

export interface DatosSeguimientoHistorico {
  acta_inicio: {
    fecha_inicio: Date;
    duracion_meses: number;
    numero_acta_aprobacion?: string;
    fecha_acta_aprobacion?: Date;
    tipo_proyecto?: string;
    centro_costos?: string;
  };
  informes_avance?: DatosInformeAvanceHistorico[];
  informe_final?: {
    resumen_ejecucion?: string;
    observaciones_objetivos?: string;
    area_conocimiento?: string;
    ciudad?: string;
    departamento?: string;
    financiacion_externa?: string;
    porcentaje_cumplimiento?: number;
    fecha_radicacion?: Date;
  };
  acta_cierre?: {
    fecha_inicio_real?: Date;
    fecha_finalizacion_real?: Date;
    duracion_real_meses?: number;
    observaciones?: string;
    ciudad_firma?: string;
    fecha_acta?: Date;
    paz_y_salvo?: boolean;
  };
}

function validar(datos: DatosSeguimientoHistorico): void {
  const a = datos.acta_inicio;
  if (!a || !(a.fecha_inicio instanceof Date) || Number.isNaN(a.fecha_inicio.getTime())) {
    throw new DatosHistoricosInvalidosError("El acta de inicio necesita la fecha de inicio");
  }
  if (!Number.isInteger(a.duracion_meses) || a.duracion_meses <= 0) {
    throw new DatosHistoricosInvalidosError("El acta de inicio necesita la duración del proyecto en meses");
  }
  const periodos = Math.ceil(a.duracion_meses / MESES_POR_PERIODO);
  for (const i of datos.informes_avance ?? []) {
    if (!Number.isInteger(i.numero_periodo) || i.numero_periodo < 1 || i.numero_periodo > periodos) {
      throw new DatosHistoricosInvalidosError(
        `El informe de avance del periodo ${i.numero_periodo} no corresponde a la duración del proyecto (${periodos} periodos)`
      );
    }
  }
}

/**
 * Registra, de una vez y en una sola transacción, el acta de inicio legalizada, los periodos con sus informes de avance
 * aprobados (uno por cada periodo de 6 meses de la duración), el informe final aprobado y el acta de cierre cerrada.
 * Con el acta de cierre cerrada el proyecto aparece como finalizado en Seguimiento.
 */
export async function registrarSeguimientoHistorico(id_proyecto: number, datos: DatosSeguimientoHistorico, id_admin: number) {
  validar(datos);
  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    include: { actasInicio: { select: { id_acta_inicio: true } }, actividades: { orderBy: { id_actividad: "asc" } } },
  });
  if (!proyecto) throw new ProyectoHistoricoNoEncontradoError();
  if (!proyecto.es_historico) throw new ProyectoNoHistoricoError();
  if (proyecto.actasInicio.length > 0) throw new SeguimientoHistoricoYaRegistradoError();

  const a = datos.acta_inicio;
  const ahora = new Date();
  const fin = restarUnDia(sumarMeses(a.fecha_inicio, a.duracion_meses));
  const cantidadPeriodos = Math.max(1, Math.ceil(a.duracion_meses / MESES_POR_PERIODO));

  return prisma.$transaction(
    async (tx) => {
      const acta = await tx.actaInicio.create({
        data: {
          id_proyecto,
          numero_acta_aprobacion: a.numero_acta_aprobacion,
          fecha_acta_aprobacion: a.fecha_acta_aprobacion,
          fecha_inicio: a.fecha_inicio,
          duracion_meses: a.duracion_meses,
          fecha_fin_estimada: fin,
          tipo_proyecto: a.tipo_proyecto,
          centro_costos: a.centro_costos,
          datos_guardados: true,
          estado: "legalizada",
          generada_por: id_admin,
          fecha_legalizacion: a.fecha_acta_aprobacion ?? a.fecha_inicio,
        },
      });

      let informes = 0;
      for (let i = 0; i < cantidadPeriodos; i++) {
        const numero = i + 1;
        const apertura = sumarMeses(a.fecha_inicio, i * MESES_POR_PERIODO);
        const limite = restarUnDia(sumarMeses(a.fecha_inicio, Math.min((i + 1) * MESES_POR_PERIODO, a.duracion_meses)));
        const periodo = await tx.periodoInforme.create({
          data: { id_proyecto, numero_periodo: numero, anio: apertura.getFullYear(), fecha_apertura: apertura, fecha_limite: limite, estado: "aprobado" },
        });
        const dato = datos.informes_avance?.find((x) => x.numero_periodo === numero);
        const informe = await tx.informeAvance.create({
          data: {
            id_proyecto,
            id_periodo_informe: periodo.id_periodo_informe,
            radicado_por: proyecto.creado_por,
            fecha_radicacion: dato?.fecha_radicacion ?? limite,
            porcentaje_avance: dato?.porcentaje_avance,
            observaciones_generales: dato?.observaciones_generales,
            estado: "aprobado",
            revisado_por: id_admin,
            fecha_revision: ahora,
          },
        });
        for (const act of proyecto.actividades) {
          const d = dato?.actividades?.find((x) => x.id_actividad === act.id_actividad);
          await tx.informeAvanceActividad.create({
            data: {
              id_informe_avance: informe.id_informe_avance,
              id_actividad: act.id_actividad,
              id_meta: act.id_meta,
              responsable: proyecto.creado_por,
              estado_actividad: d?.estado_actividad ?? "no iniciada",
              porcentaje_cumplimiento: d?.porcentaje_cumplimiento ?? 0,
              observacion: d?.observacion,
              semanas_trabajadas: Array(SEMANAS_POR_PERIODO).fill(false),
            },
          });
        }
        informes++;
      }

      const f = datos.informe_final ?? {};
      const final = await tx.informeFinal.create({
        data: {
          id_proyecto,
          area_conocimiento: f.area_conocimiento,
          ciudad: f.ciudad,
          departamento: f.departamento,
          financiacion_externa: f.financiacion_externa,
          resumen_ejecucion: f.resumen_ejecucion,
          observaciones_objetivos: f.observaciones_objetivos,
          porcentaje_cumplimiento: f.porcentaje_cumplimiento,
          radicado_por: proyecto.creado_por,
          fecha_radicacion: f.fecha_radicacion ?? fin,
          estado: "aprobado",
          revisado_por: id_admin,
          fecha_revision: ahora,
        },
      });

      const c = datos.acta_cierre ?? {};
      const cierre = await tx.actaCierre.create({
        data: {
          id_proyecto,
          id_informe_final: final.id_informe_final,
          fecha_inicio_real: c.fecha_inicio_real ?? a.fecha_inicio,
          fecha_finalizacion_real: c.fecha_finalizacion_real ?? fin,
          duracion_real_meses: c.duracion_real_meses ?? a.duracion_meses,
          paz_y_salvo: c.paz_y_salvo ?? true,
          observaciones: c.observaciones,
          ciudad_firma: c.ciudad_firma,
          fecha_acta: c.fecha_acta,
          estado: "cerrada",
          generada_por: id_admin,
        },
      });

      return {
        id_acta_inicio: acta.id_acta_inicio,
        periodos_con_informe: informes,
        id_informe_final: final.id_informe_final,
        id_acta_cierre: cierre.id_acta_cierre,
      };
    },
    { timeout: 60_000 }
  );
}
