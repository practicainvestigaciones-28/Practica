import { apiFetch } from '../../../shared/api/client'

export interface TipoProductoItem {
  id_tipo_producto: number
  nombre: string
  obligatorio: boolean
  activo: boolean
}

export interface SubcategoriaProductoItem {
  id_subcategoria: number
  nombre: string
  activo: boolean
  tipos: TipoProductoItem[]
}

export interface CategoriaProductoItem {
  id_categoria: number
  nombre: string
  activo: boolean
  subcategorias: SubcategoriaProductoItem[]
}

export function listarCategoriasProducto(soloActivos?: boolean): Promise<CategoriaProductoItem[]> {
  return apiFetch(`/productos/categorias${soloActivos ? '?activo=true' : ''}`)
}

interface RespuestaCategoria {
  mensaje: string
  registro: CategoriaProductoItem
}

export function crearCategoriaProducto(nombre: string): Promise<RespuestaCategoria> {
  return apiFetch('/productos/categorias', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function actualizarCategoriaProducto(id_categoria: number, nombre: string): Promise<RespuestaCategoria> {
  return apiFetch(`/productos/categorias/${id_categoria}`, { method: 'PUT', body: JSON.stringify({ nombre }) })
}

export function cambiarEstadoCategoriaProducto(id_categoria: number, activo: boolean): Promise<RespuestaCategoria> {
  return apiFetch(`/productos/categorias/${id_categoria}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}

interface RespuestaSubcategoria {
  mensaje: string
  registro: SubcategoriaProductoItem
}

export function crearSubcategoriaProducto(id_categoria: number, nombre: string): Promise<RespuestaSubcategoria> {
  return apiFetch('/productos/subcategorias', { method: 'POST', body: JSON.stringify({ id_categoria, nombre }) })
}

export function actualizarSubcategoriaProducto(id_subcategoria: number, nombre: string): Promise<RespuestaSubcategoria> {
  return apiFetch(`/productos/subcategorias/${id_subcategoria}`, { method: 'PUT', body: JSON.stringify({ nombre }) })
}

export function cambiarEstadoSubcategoriaProducto(
  id_subcategoria: number,
  activo: boolean
): Promise<RespuestaSubcategoria> {
  return apiFetch(`/productos/subcategorias/${id_subcategoria}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}

interface RespuestaTipoProducto {
  mensaje: string
  registro: TipoProductoItem
}

export function crearTipoProducto(
  id_subcategoria: number,
  nombre: string,
  obligatorio?: boolean
): Promise<RespuestaTipoProducto> {
  return apiFetch('/productos/tipos', {
    method: 'POST',
    body: JSON.stringify({ id_subcategoria, nombre, obligatorio }),
  })
}

export function actualizarTipoProducto(
  id_tipo_producto: number,
  nombre: string,
  obligatorio?: boolean
): Promise<RespuestaTipoProducto> {
  return apiFetch(`/productos/tipos/${id_tipo_producto}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre, obligatorio }),
  })
}

export function cambiarEstadoTipoProducto(id_tipo_producto: number, activo: boolean): Promise<RespuestaTipoProducto> {
  return apiFetch(`/productos/tipos/${id_tipo_producto}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}
