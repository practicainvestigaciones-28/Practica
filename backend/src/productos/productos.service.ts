import { prisma } from "../config/prisma";
import { verificarPermisoProyecto } from "../utils/permisosProyecto";
export { ProyectoNoEncontradoError, NoAutorizadoProyectoError } from "../utils/permisosProyecto";

export class ProductoNoEncontradoError extends Error {
  constructor() {
    super("Ese producto no está registrado en este proyecto");
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
  return prisma.categoriaProducto.create({ data: { nombre } });
}
export async function listarCategorias() {
  return prisma.categoriaProducto.findMany({
    include: { subcategorias: { include: { tipos: true } } },
    orderBy: { nombre: "asc" },
  });
}

export async function crearSubcategoria(id_categoria: number, nombre: string) {
  return prisma.subcategoriaProducto.create({ data: { id_categoria, nombre } });
}
export async function listarSubcategorias() {
  return prisma.subcategoriaProducto.findMany({ include: { categoria: true, tipos: true } });
}

export async function crearTipoProducto(id_subcategoria: number, nombre: string, obligatorio = false) {
  return prisma.tipoProducto.create({ data: { id_subcategoria, nombre, obligatorio } });
}
export async function listarTiposProducto() {
  return prisma.tipoProducto.findMany({ include: { subcategoria: { include: { categoria: true } } } });
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
