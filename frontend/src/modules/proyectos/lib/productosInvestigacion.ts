import type { CategoriaProductoItem } from '../api/productos'

export interface TipoProductoLocal {
  id: number
  nombre: string
  idReal: number | null
}

export interface SubcategoriaProductoLocal {
  id: number
  nombre: string
  nota?: string
  tipos: TipoProductoLocal[]
}

export interface CategoriaProductoLocal {
  id: number
  nombre: string
  subtitulo?: string
  subcategorias: SubcategoriaProductoLocal[]
}

const norm = (s: string) => s.trim().toLowerCase()

// Nota informativa que complementa el catálogo real (el backend no guarda
// este texto, es solo una ayuda visual al llenar el formulario). Si el
// admin renombra la subcategoría, la nota deja de coincidir y no se muestra.
const notasPorSubcategoria: Record<string, string> = {
  'artículos de investigación':
    'Se sugiere que la categorización de la revista esté asociada a un cuartil Q1, Q2, Q3 o Q4 de JCR o SJR.',
}

export function mapearCategoriasBackend(categoriasReales: CategoriaProductoItem[]): CategoriaProductoLocal[] {
  return categoriasReales.map((c) => ({
    id: c.id_categoria,
    nombre: c.nombre,
    subtitulo: '(Selección obligatoria)',
    subcategorias: c.subcategorias.map((s) => ({
      id: s.id_subcategoria,
      nombre: s.nombre,
      nota: notasPorSubcategoria[norm(s.nombre)],
      tipos: s.tipos.map((t) => ({ id: t.id_tipo_producto, nombre: t.nombre, idReal: t.id_tipo_producto })),
    })),
  }))
}
