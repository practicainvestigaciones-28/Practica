import { apiFetch } from './client'

export interface TipoProductoItem {
  id_tipo_producto: number
  nombre: string
  obligatorio: boolean
}

export interface SubcategoriaProductoItem {
  id_subcategoria: number
  nombre: string
  tipos: TipoProductoItem[]
}

export interface CategoriaProductoItem {
  id_categoria: number
  nombre: string
  subcategorias: SubcategoriaProductoItem[]
}

export function listarCategoriasProducto(): Promise<CategoriaProductoItem[]> {
  return apiFetch('/productos/categorias')
}
