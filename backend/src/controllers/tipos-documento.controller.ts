import type { Request, Response, NextFunction } from "express";
import * as tiposDocService from "../services/tipos-documento.service";

// Etapas
export async function crearEtapa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "nombre es obligatorio" });
      return;
    }
    res.status(201).json({ mensaje: "Etapa creada correctamente", etapa: await tiposDocService.crearEtapa(nombre, descripcion) });
  } catch (error) {
    next(error);
  }
}
export async function listarEtapas(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await tiposDocService.listarEtapas());
  } catch (error) {
    next(error);
  }
}

// Tipos de documento (RQF36)
export async function crearTipoDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_etapa, nombre, descripcion, archivo } = req.body;
    if (!id_etapa || !nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_etapa y nombre son obligatorios" });
      return;
    }
    const tipoDocumento = await tiposDocService.crearTipoDocumento({ id_etapa, nombre, descripcion, archivo });
    res.status(201).json({ mensaje: "Tipo de documento creado correctamente", tipoDocumento });
  } catch (error) {
    next(error);
  }
}

export async function listarTiposDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_etapa, soloActivos } = req.query;
    const tipos = await tiposDocService.listarTiposDocumento({
      id_etapa: id_etapa ? Number(id_etapa) : undefined,
      soloActivos: soloActivos === "true",
    });
    res.status(200).json(tipos);
  } catch (error) {
    next(error);
  }
}

export async function actualizarTipoDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tipoDocumento = await tiposDocService.actualizarTipoDocumento(Number(req.params.id), req.body);
    res.status(200).json({ mensaje: "Tipo de documento actualizado correctamente", tipoDocumento });
  } catch (error) {
    next(error);
  }
}
