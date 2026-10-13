import { useEffect, useState, type ReactNode } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'

interface ItemBase {
  id: number
  nombre: string
  activo: boolean
}

export interface ColumnaCatalogo<T> {
  titulo: string
  centrada?: boolean
  render: (item: T, cambiar: (cambio: Partial<T>) => void) => ReactNode
}

/** Tabla de parametrización editable fila por fila: cada fila guarda sus
 * cambios con su propio botón; activar/desactivar se guarda de inmediato. */
function CatalogoEditable<T extends ItemBase>({
  items,
  columnas,
  crearNuevo,
  textoAgregar,
  ocupado,
  onGuardar,
  onEliminar,
}: {
  items: T[]
  columnas: ColumnaCatalogo<T>[]
  crearNuevo: () => T
  textoAgregar: string
  ocupado: boolean
  onGuardar: (item: T) => Promise<boolean>
  onEliminar: (item: T) => void
}) {
  const [borradores, setBorradores] = useState<T[]>(items)
  const [busqueda, setBusqueda] = useState('')
  const [eliminar, setEliminar] = useState<T | null>(null)

  useEffect(() => {
    setBorradores(items)
  }, [items])

  const original = (id: number) => items.find((x) => x.id === id)
  const modificado = (b: T) => JSON.stringify(b) !== JSON.stringify(original(b.id))
  const cambiar = (id: number, cambio: Partial<T>) => setBorradores((prev) => prev.map((x) => (x.id === id ? { ...x, ...cambio } : x)))
  const visibles = borradores.filter((x) => !busqueda.trim() || x.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  return (
    <>
      <div className="seg-filtros" style={{ marginBottom: 12 }}>
        <button type="button" className="seg-btn" onClick={() => setBorradores((prev) => [...prev, { ...crearNuevo(), id: -Date.now() }])}>
          <Plus size={14} /> {textoAgregar}
        </button>
        <div className="seg-search">
          <Search size={16} />
          <input placeholder="Buscar por nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="seg-tabla-wrap">
        <table className="seg-tabla">
          <thead>
            <tr>
              {columnas.map((c) => <th key={c.titulo} className={c.centrada ? 'c' : ''}>{c.titulo}</th>)}
              <th className="c">Activo</th>
              <th className="c">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={columnas.length + 2} className="seg-vacio">Sin registros.</td></tr>
            )}
            {visibles.map((b) => {
              const nuevo = b.id < 0
              return (
                <tr key={b.id}>
                  {columnas.map((c) => (
                    <td key={c.titulo} className={c.centrada ? 'c' : ''}>{c.render(b, (cambio) => cambiar(b.id, cambio))}</td>
                  ))}
                  <td className="c">
                    <input
                      type="checkbox"
                      aria-label="Activo"
                      checked={b.activo}
                      disabled={ocupado}
                      onChange={(e) => (nuevo ? cambiar(b.id, { activo: e.target.checked } as Partial<T>) : onGuardar({ ...b, activo: e.target.checked }))}
                    />
                  </td>
                  <td className="c">
                    <div className="seg-botones-fila" style={{ justifyContent: 'center', marginTop: 0 }}>
                      {(nuevo || modificado(b)) && (
                        <button type="button" className="seg-btn seg-btn-sm" disabled={ocupado || !b.nombre.trim()} onClick={() => onGuardar(b)}>
                          Guardar
                        </button>
                      )}
                      <button
                        type="button"
                        className="seg-icono"
                        aria-label="Eliminar"
                        onClick={() => (nuevo ? setBorradores((prev) => prev.filter((x) => x.id !== b.id)) : setEliminar(b))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {eliminar && (
        <ConfirmModal
          mensaje={`¿Eliminar "${eliminar.nombre}"? Si ya está en uso, es preferible desactivarlo.`}
          onClose={() => setEliminar(null)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setEliminar(null), variante: 'azul' }}
          botonPrimario={{
            label: 'Eliminar',
            variante: 'rojo',
            onClick: () => {
              onEliminar(eliminar)
              setEliminar(null)
            },
          }}
        />
      )}
    </>
  )
}

export default CatalogoEditable
