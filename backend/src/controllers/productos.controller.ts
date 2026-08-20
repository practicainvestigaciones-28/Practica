import type { Request, Response, NextFunction } from "express";
import * as productosService from "../services/productos.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof productosService.ProyectoNoEncontradoError ||
    error instanceof productosService.ProductoNoEncontradoError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof productosService.NoAutorizadoProyectoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

// Catálogo (RQF32)
export async function crearCategoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre } = req.body;
    if (!nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "nombre es obligatorio" });
      return;
    }
    res.status(201).json({ mensaje: "Categoría creada correctamente", registro: await productosService.crearCategoria(nombre) });
  } catch (error) {
    next(error);
  }
}
export async function listarCategorias(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await productosService.listarCategorias());
  } catch (error) {
    next(error);
  }
}

export async function crearSubcategoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_categoria, nombre } = req.body;
    if (!id_categoria || !nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_categoria y nombre son obligatorios" });
      return;
    }
    res.status(201).json({
      mensaje: "Subcategoría creada correctamente",
      registro: await productosService.crearSubcategoria(id_categoria, nombre),
    });
  } catch (error) {
    next(error);
  }
}
export async function listarSubcategorias(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await productosService.listarSubcategorias());
  } catch (error) {
    next(error);
  }
}

export async function crearTipoProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_subcategoria, nombre, obligatorio } = req.body;
    if (!id_subcategoria || !nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_subcategoria y nombre son obligatorios" });
      return;
    }
    res.status(201).json({
      mensaje: "Tipo de producto creado correctamente",
      registro: await productosService.crearTipoProducto(id_subcategoria, nombre, Boolean(obligatorio)),
    });
  } catch (error) {
    next(error);
  }
}
export async function listarTiposProducto(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await productosService.listarTiposProducto());
  } catch (error) {
    next(error);
  }
}

// Registro por proyecto (RQF30)
export async function agregarProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_tipo_producto, cantidad } = req.body;
    if (!id_tipo_producto) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_tipo_producto es obligatorio" });
      return;
    }
    const registro = await productosService.agregarProducto(Number(req.params.id), { id_tipo_producto, cantidad }, usuarioReq(req));
    res.status(201).json({ mensaje: "Producto registrado correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarProductos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await productosService.listarProductos(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarProducto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await productosService.quitarProducto(Number(req.params.id), Number(req.params.idProducto), usuarioReq(req));
    res.status(200).json({ mensaje: "Producto eliminado correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

// Validación (RQF31)
export async function validarProductosObligatorios(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await productosService.validarProductosObligatorios(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
