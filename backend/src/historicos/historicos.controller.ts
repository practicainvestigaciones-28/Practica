import type { Request, Response, NextFunction } from "express";
import * as service from "./historicos.service";
import { emitirCambio } from "../ws/socket";

function aFecha(v: unknown): Date | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new service.DatosHistoricosInvalidosError(`Fecha inválida: ${String(v)}`);
  return d;
}

/** Convierte las fechas que llegan como texto en el JSON a Date. */
function normalizar(body: Record<string, any>): service.DatosSeguimientoHistorico {
  const a = body.acta_inicio ?? {};
  const f = body.informe_final;
  const c = body.acta_cierre;
  return {
    acta_inicio: {
      ...a,
      fecha_inicio: aFecha(a.fecha_inicio) as Date,
      fecha_acta_aprobacion: aFecha(a.fecha_acta_aprobacion),
    },
    informes_avance: Array.isArray(body.informes_avance)
      ? body.informes_avance.map((i: Record<string, any>) => ({ ...i, fecha_radicacion: aFecha(i.fecha_radicacion) }) as service.DatosInformeAvanceHistorico)
      : undefined,
    informe_final: f ? { ...f, fecha_radicacion: aFecha(f.fecha_radicacion) } : undefined,
    acta_cierre: c
      ? {
          ...c,
          fecha_inicio_real: aFecha(c.fecha_inicio_real),
          fecha_finalizacion_real: aFecha(c.fecha_finalizacion_real),
          fecha_acta: aFecha(c.fecha_acta),
        }
      : undefined,
  };
}

/** POST /api/proyectos/:id/historico/seguimiento — solo Administrador. */
export async function registrarSeguimientoHistorico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.registrarSeguimientoHistorico(Number(req.params.id), normalizar(req.body ?? {}), req.usuario!.id_usuario);
    emitirCambio("proyectos");
    emitirCambio("seguimiento");
    res.status(201).json({ mensaje: "Seguimiento histórico registrado correctamente", ...resultado });
  } catch (error) {
    if (error instanceof service.ProyectoHistoricoNoEncontradoError) {
      res.status(404).json({ error: "No encontrado", mensaje: error.message });
      return;
    }
    if (error instanceof service.ProyectoNoHistoricoError || error instanceof service.SeguimientoHistoricoYaRegistradoError) {
      res.status(409).json({ error: "No permitido", mensaje: error.message });
      return;
    }
    if (error instanceof service.DatosHistoricosInvalidosError) {
      res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
      return;
    }
    next(error);
  }
}
