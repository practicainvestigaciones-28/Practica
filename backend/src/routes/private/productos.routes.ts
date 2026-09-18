import { Router } from "express";
import * as productos from "../../productos/productos.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const productosRoutes = Router();

productosRoutes.use(autenticar);

productosRoutes.get("/categorias", productos.listarCategorias);
productosRoutes.post("/categorias", autorizar("Administrador"), productos.crearCategoria);
productosRoutes.put("/categorias/:id", autorizar("Administrador"), productos.actualizarCategoria);
productosRoutes.patch("/categorias/:id/estado", autorizar("Administrador"), productos.cambiarEstadoCategoria);

productosRoutes.get("/subcategorias", productos.listarSubcategorias);
productosRoutes.post("/subcategorias", autorizar("Administrador"), productos.crearSubcategoria);
productosRoutes.put("/subcategorias/:id", autorizar("Administrador"), productos.actualizarSubcategoria);
productosRoutes.patch("/subcategorias/:id/estado", autorizar("Administrador"), productos.cambiarEstadoSubcategoria);

productosRoutes.get("/tipos", productos.listarTiposProducto);
productosRoutes.post("/tipos", autorizar("Administrador"), productos.crearTipoProducto);
productosRoutes.put("/tipos/:id", autorizar("Administrador"), productos.actualizarTipoProducto);
productosRoutes.patch("/tipos/:id/estado", autorizar("Administrador"), productos.cambiarEstadoTipoProducto);
