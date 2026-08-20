import { Router } from "express";
import * as productos from "../controllers/productos.controller";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

export const productosRoutes = Router();

productosRoutes.use(autenticar);

productosRoutes.get("/categorias", productos.listarCategorias);
productosRoutes.post("/categorias", autorizar("Administrador"), productos.crearCategoria);

productosRoutes.get("/subcategorias", productos.listarSubcategorias);
productosRoutes.post("/subcategorias", autorizar("Administrador"), productos.crearSubcategoria);

productosRoutes.get("/tipos", productos.listarTiposProducto);
productosRoutes.post("/tipos", autorizar("Administrador"), productos.crearTipoProducto);
