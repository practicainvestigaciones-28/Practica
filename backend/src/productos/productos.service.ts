import { prisma } from "../config/prisma";
import { verificarPermisoProyecto } from "../utils/permisosProyecto";
export { ProyectoNoEncontradoError, NoAutorizadoProyectoError } from "../utils/permisosProyecto";

export class ProductoNoEncontradoError extends Error {
  constructor() {
    super("Ese producto no está registrado en este proyecto");
  }
}

export class CategoriaNoEncontradaError extends Error {
  constructor() {
    super("La categoría indicada no existe");
  }
}

export class SubcategoriaNoEncontradaError extends Error {
  constructor() {
    super("La subcategoría indicada no existe");
  }
}

export class TipoProductoNoEncontradoError extends Error {
  constructor() {
    super("El tipo de producto indicado no existe");
  }
}

interface UsuarioQueEdita {
  id_usuario: number;
  roles: string[];
}

// ---------------------------------------------------------------------------
// RQF32 - Administración de categorías de productos (catálogo, solo Admin)
// ---------------------------------------------------------------------------

export async function crearCategoria(nombre: string) {
  // Las categorías nuevas se agregan al final del orden de aparición existente.
  const ultima = await prisma.categoriaProducto.findFirst({ orderBy: { orden: "desc" } });
  return prisma.categoriaProducto.create({ data: { nombre, orden: (ultima?.orden ?? 0) + 1 } });
}
export async function listarCategorias(soloActivos?: boolean) {
  return prisma.categoriaProducto.findMany({
    where: soloActivos ? { activo: true } : undefined,
    include: {
      subcategorias: {
        where: soloActivos ? { activo: true } : undefined,
        include: { tipos: { where: soloActivos ? { activo: true } : undefined } },
      },
    },
    orderBy: { orden: "asc" },
  });
}

/** Editar el nombre de una categoría existente. Solo Administrador. */
export async function actualizarCategoria(id_categoria: number, nombre: string) {
  const existente = await prisma.categoriaProducto.findUnique({ where: { id_categoria } });
  if (!existente) throw new CategoriaNoEncontradaError();

  return prisma.categoriaProducto.update({ where: { id_categoria }, data: { nombre } });
}

/** Activar/desactivar una categoría. No se borra físicamente: hay proyectos que ya referencian sus tipos. */
export async function cambiarEstadoCategoria(id_categoria: number, activo: boolean) {
  const existente = await prisma.categoriaProducto.findUnique({ where: { id_categoria } });
  if (!existente) throw new CategoriaNoEncontradaError();

  return prisma.categoriaProducto.update({ where: { id_categoria }, data: { activo } });
}

export async function crearSubcategoria(id_categoria: number, nombre: string) {
  return prisma.subcategoriaProducto.create({ data: { id_categoria, nombre } });
}
export async function listarSubcategorias() {
  return prisma.subcategoriaProducto.findMany({ include: { categoria: true, tipos: true } });
}

/** Editar el nombre de una subcategoría existente. Solo Administrador. */
export async function actualizarSubcategoria(id_subcategoria: number, nombre: string) {
  const existente = await prisma.subcategoriaProducto.findUnique({ where: { id_subcategoria } });
  if (!existente) throw new SubcategoriaNoEncontradaError();

  return prisma.subcategoriaProducto.update({ where: { id_subcategoria }, data: { nombre } });
}

/** Activar/desactivar una subcategoría. No se borra físicamente: hay proyectos que ya referencian sus tipos. */
export async function cambiarEstadoSubcategoria(id_subcategoria: number, activo: boolean) {
  const existente = await prisma.subcategoriaProducto.findUnique({ where: { id_subcategoria } });
  if (!existente) throw new SubcategoriaNoEncontradaError();

  return prisma.subcategoriaProducto.update({ where: { id_subcategoria }, data: { activo } });
}

export async function crearTipoProducto(id_subcategoria: number, nombre: string, obligatorio = false) {
  return prisma.tipoProducto.create({ data: { id_subcategoria, nombre, obligatorio } });
}
export async function listarTiposProducto() {
  return prisma.tipoProducto.findMany({ include: { subcategoria: { include: { categoria: true } } } });
}

/** Editar el nombre / obligatoriedad de un tipo de producto existente. Solo Administrador. */
export async function actualizarTipoProducto(id_tipo_producto: number, nombre: string, obligatorio?: boolean) {
  const existente = await prisma.tipoProducto.findUnique({ where: { id_tipo_producto } });
  if (!existente) throw new TipoProductoNoEncontradoError();

  return prisma.tipoProducto.update({
    where: { id_tipo_producto },
    data: { nombre, ...(obligatorio !== undefined ? { obligatorio } : {}) },
  });
}

/** Activar/desactivar un tipo de producto. No se borra físicamente: hay proyectos que ya lo registraron. */
export async function cambiarEstadoTipoProducto(id_tipo_producto: number, activo: boolean) {
  const existente = await prisma.tipoProducto.findUnique({ where: { id_tipo_producto } });
  if (!existente) throw new TipoProductoNoEncontradoError();

  return prisma.tipoProducto.update({ where: { id_tipo_producto }, data: { activo } });
}

// ---------------------------------------------------------------------------
// RQF30 - Registro de productos de investigación del proyecto
// ---------------------------------------------------------------------------

export async function agregarProducto(
  id_proyecto: number,
  datos: { id_tipo_producto: number; cantidad?: number },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  return prisma.proyectoProducto.upsert({
    where: { id_proyecto_id_tipo_producto: { id_proyecto, id_tipo_producto: datos.id_tipo_producto } },
    update: { cantidad: datos.cantidad ?? 1 },
    create: { id_proyecto, id_tipo_producto: datos.id_tipo_producto, cantidad: datos.cantidad ?? 1 },
    include: { tipoProducto: { include: { subcategoria: { include: { categoria: true } } } } },
  });
}

export async function listarProductos(id_proyecto: number) {
  return prisma.proyectoProducto.findMany({
    where: { id_proyecto },
    include: { tipoProducto: { include: { subcategoria: { include: { categoria: true } } } } },
  });
}

export async function quitarProducto(id_proyecto: number, id_proyecto_producto: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.proyectoProducto.findUnique({ where: { id_proyecto_producto } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new ProductoNoEncontradoError();
  await prisma.proyectoProducto.delete({ where: { id_proyecto_producto } });
}

// ---------------------------------------------------------------------------
// RQF31 - Validación de productos obligatorios
// ---------------------------------------------------------------------------

export interface ResultadoValidacionProductos {
  cumple: boolean;
  productosObligatorios: { id_tipo_producto: number; nombre: string }[];
  productosFaltantes: { id_tipo_producto: number; nombre: string }[];
}

export async function validarProductosObligatorios(id_proyecto: number): Promise<ResultadoValidacionProductos> {
  const [obligatorios, registrados] = await Promise.all([
    prisma.tipoProducto.findMany({ where: { obligatorio: true } }),
    prisma.proyectoProducto.findMany({ where: { id_proyecto }, select: { id_tipo_producto: true } }),
  ]);

  const idsRegistrados = new Set(registrados.map((r) => r.id_tipo_producto));
  const faltantes = obligatorios.filter((o) => !idsRegistrados.has(o.id_tipo_producto));

  return {
    cumple: faltantes.length === 0,
    productosObligatorios: obligatorios.map((o) => ({ id_tipo_producto: o.id_tipo_producto, nombre: o.nombre })),
    productosFaltantes: faltantes.map((o) => ({ id_tipo_producto: o.id_tipo_producto, nombre: o.nombre })),
  };
}
