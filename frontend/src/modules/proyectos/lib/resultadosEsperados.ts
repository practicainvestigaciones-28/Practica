import type { ProductoDelProyecto } from '../api/proyectos'
import type { CategoriaProductoItem } from '../api/productos'

export interface CategoriaResultado {
  nombre: string
  total: number
  subcategorias: { nombre: string; tipos: { nombre: string; cantidad: number }[] }[]
}

/**
 * Resultados esperados agrupados categoría → subcategorías → tipos de
 * producto, en el mismo orden de la tabla del formulario (el del catálogo).
 * Varias subcategorías de una misma categoría quedan dentro de ella.
 */
export function agruparResultados(productos: ProductoDelProyecto[], catalogo: CategoriaProductoItem[]): CategoriaResultado[] {
  const posicion = new Map<number, number>()
  for (const c of catalogo) for (const s of c.subcategorias) for (const t of s.tipos) posicion.set(t.id_tipo_producto, posicion.size)
  const ordenados = [...productos].sort(
    (a, b) =>
      (posicion.get(a.tipoProducto.id_tipo_producto) ?? Infinity) - (posicion.get(b.tipoProducto.id_tipo_producto) ?? Infinity) ||
      a.id_proyecto_producto - b.id_proyecto_producto
  )

  const categorias = new Map<string, { nombre: string; total: number; subcategorias: Map<string, CategoriaResultado['subcategorias'][number]> }>()
  for (const p of ordenados) {
    const nombreCat = p.tipoProducto.subcategoria.categoria.nombre
    const nombreSub = p.tipoProducto.subcategoria.nombre
    const cat = categorias.get(nombreCat) ?? { nombre: nombreCat, total: 0, subcategorias: new Map() }
    const sub = cat.subcategorias.get(nombreSub) ?? { nombre: nombreSub, tipos: [] }
    sub.tipos.push({ nombre: p.tipoProducto.nombre, cantidad: p.cantidad })
    cat.subcategorias.set(nombreSub, sub)
    cat.total += p.cantidad
    categorias.set(nombreCat, cat)
  }
  return [...categorias.values()].map((c) => ({ ...c, subcategorias: [...c.subcategorias.values()] }))
}
