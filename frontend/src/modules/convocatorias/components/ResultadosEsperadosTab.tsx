import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, SquarePen, Save, X } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { ApiError } from '../../../shared/api/client'
import * as productosApi from '../../proyectos/api/productos'
import type {
  CategoriaProductoItem,
  SubcategoriaProductoItem,
  TipoProductoItem,
} from '../../proyectos/api/productos'
import './ResultadosEsperados.css'

type NivelEditable = 'categoria' | 'subcategoria' | 'tipo'

interface ObjetivoEliminar {
  nivel: NivelEditable
  id: number
  nombre: string
}

interface EstadoArrastre {
  clave: string
  id: number
  ancho: number
  alto: number
  offsetX: number
  offsetY: number
  x: number
  y: number
  contenido: string
}

interface ControladorArrastre<T> {
  arrastre: EstadoArrastre | null
  iniciar: (e: ReactPointerEvent<HTMLElement>, item: T) => void
}

/**
 * Arrastrar y soltar tipo "cuadro flotante": al agarrar el mango, el elemento
 * se despega y sigue el cursor, y la lista se reordena en vivo según sobre qué
 * fila quede el cursor. El prefijo evita que se mezclen listas distintas (p. ej.
 * subcategorías de categorías diferentes).
 *
 * Usa listeners en window (no Pointer Capture): como la lista se reordena en
 * vivo, React mueve el nodo del mango arrastrado en el DOM en cada paso, y eso
 * libera la captura del puntero a mitad de camino, dejando el "soltar" sin disparar.
 */
function useArrastrarLista<T>(
  prefijo: string,
  items: T[],
  obtenerId: (item: T) => number,
  obtenerTexto: (item: T) => string,
  setItems: (items: T[]) => void,
  guardarOrden: (ids: number[]) => void
): ControladorArrastre<T> {
  const itemsRef = useRef(items)
  itemsRef.current = items

  const [arrastre, setArrastre] = useState<EstadoArrastre | null>(null)
  const arrastreRef = useRef(arrastre)
  arrastreRef.current = arrastre

  const iniciar = (e: ReactPointerEvent<HTMLElement>, item: T) => {
    e.preventDefault()
    const fila = e.currentTarget.closest<HTMLElement>('[data-drag-row]')
    if (!fila) return
    const rect = fila.getBoundingClientRect()
    const id = obtenerId(item)
    setArrastre({
      clave: `${prefijo}-${id}`,
      id,
      ancho: rect.width,
      alto: rect.height,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      x: rect.left,
      y: rect.top,
      contenido: obtenerTexto(item),
    })
  }

  useEffect(() => {
    if (!arrastre) return

    const mover = (e: PointerEvent) => {
      const actual = arrastreRef.current
      if (!actual) return
      const x = e.clientX - actual.offsetX
      const y = e.clientY - actual.offsetY
      setArrastre((prev) => (prev ? { ...prev, x, y } : prev))

      const elementos = document.elementsFromPoint(e.clientX, e.clientY)
      const filaDebajo = elementos.find(
        (el): el is HTMLElement =>
          el instanceof HTMLElement &&
          !!el.dataset.dragRow &&
          el.dataset.dragRow.startsWith(`${prefijo}-`) &&
          el.dataset.dragRow !== actual.clave
      )
      if (!filaDebajo) return
      const idDebajo = Number(filaDebajo.dataset.dragRow!.slice(prefijo.length + 1))

      const actuales = itemsRef.current
      const origenIdx = actuales.findIndex((it) => obtenerId(it) === actual.id)
      const destinoIdx = actuales.findIndex((it) => obtenerId(it) === idDebajo)
      if (origenIdx === -1 || destinoIdx === -1 || origenIdx === destinoIdx) return
      const copia = [...actuales]
      const [movido] = copia.splice(origenIdx, 1)
      copia.splice(destinoIdx, 0, movido)
      setItems(copia)
    }

    const soltar = () => {
      guardarOrden(itemsRef.current.map(obtenerId))
      setArrastre(null)
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    window.addEventListener('blur', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      window.removeEventListener('blur', soltar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastre !== null])

  return { arrastre, iniciar }
}

function CuadroFlotante({ arrastre }: { arrastre: EstadoArrastre | null }) {
  if (!arrastre) return null
  return (
    <div
      className="prod-drag-clone"
      style={{ left: arrastre.x, top: arrastre.y, width: arrastre.ancho, height: arrastre.alto }}
    >
      <GripVertical size={14} />
      {arrastre.contenido}
    </div>
  )
}

function ResultadosEsperadosTab() {
  const [categorias, setCategorias] = useState<CategoriaProductoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())

  const [editando, setEditando] = useState<{ nivel: NivelEditable; id: number } | null>(null)
  const [nombreEditado, setNombreEditado] = useState('')
  const [obligatorioEditado, setObligatorioEditado] = useState(false)

  const [agregandoCategoria, setAgregandoCategoria] = useState(false)
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState('')

  const [agregandoSubcategoriaEn, setAgregandoSubcategoriaEn] = useState<number | null>(null)
  const [nombreNuevaSubcategoria, setNombreNuevaSubcategoria] = useState('')

  const [agregandoTipoEn, setAgregandoTipoEn] = useState<number | null>(null)
  const [nombreNuevoTipo, setNombreNuevoTipo] = useState('')
  const [obligatorioNuevoTipo, setObligatorioNuevoTipo] = useState(false)

  const [eliminar, setEliminar] = useState<ObjetivoEliminar | null>(null)

  const refrescar = () => {
    setCargando(true)
    productosApi
      .listarCategoriasProducto()
      .then(setCategorias)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las categorías.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    refrescar()
  }, [])

  const toggleExpandida = (id: number) => {
    setExpandidas((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  const guardarOrdenCategorias = (ids: number[]) => {
    productosApi.reordenarCategoriasProducto(ids).catch(() => refrescar())
  }

  const actualizarSubcategorias = (id_categoria: number, subcategorias: SubcategoriaProductoItem[]) => {
    setCategorias((actual) => actual.map((c) => (c.id_categoria === id_categoria ? { ...c, subcategorias } : c)))
  }
  const guardarOrdenSubcategorias = (id_categoria: number, ids: number[]) => {
    productosApi.reordenarSubcategoriasProducto(id_categoria, ids).catch(() => refrescar())
  }

  const actualizarTipos = (id_subcategoria: number, tipos: TipoProductoItem[]) => {
    setCategorias((actual) =>
      actual.map((c) => ({
        ...c,
        subcategorias: c.subcategorias.map((s) => (s.id_subcategoria === id_subcategoria ? { ...s, tipos } : s)),
      }))
    )
  }
  const guardarOrdenTipos = (id_subcategoria: number, ids: number[]) => {
    productosApi.reordenarTiposProducto(id_subcategoria, ids).catch(() => refrescar())
  }

  const arrastreCategorias = useArrastrarLista(
    'cat',
    categorias,
    (c) => c.id_categoria,
    (c) => c.nombre,
    setCategorias,
    guardarOrdenCategorias
  )

  const iniciarEdicion = (nivel: NivelEditable, id: number, nombreActual: string, obligatorioActual = false) => {
    setError('')
    setEditando({ nivel, id })
    setNombreEditado(nombreActual)
    setObligatorioEditado(obligatorioActual)
  }

  const cancelarEdicion = () => setEditando(null)

  const guardarEdicion = () => {
    if (!editando || !nombreEditado.trim()) return
    const nombre = nombreEditado.trim()
    const tarea =
      editando.nivel === 'categoria'
        ? productosApi.actualizarCategoriaProducto(editando.id, nombre)
        : editando.nivel === 'subcategoria'
          ? productosApi.actualizarSubcategoriaProducto(editando.id, nombre)
          : productosApi.actualizarTipoProducto(editando.id, nombre, obligatorioEditado)

    tarea
      .then(() => {
        setEditando(null)
        refrescar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio.'))
  }

  const toggleActivo = (nivel: NivelEditable, id: number, activoActual: boolean) => {
    setError('')
    const tarea =
      nivel === 'categoria'
        ? productosApi.cambiarEstadoCategoriaProducto(id, !activoActual)
        : nivel === 'subcategoria'
          ? productosApi.cambiarEstadoSubcategoriaProducto(id, !activoActual)
          : productosApi.cambiarEstadoTipoProducto(id, !activoActual)

    tarea
      .then(() => refrescar())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.'))
  }

  const pedirEliminar = (nivel: NivelEditable, id: number, nombre: string) => setEliminar({ nivel, id, nombre })
  const cancelarEliminar = () => setEliminar(null)

  // Sin borrado físico: puede haber proyectos que ya referencien estas filas. "Eliminar" desactiva.
  const confirmarEliminar = () => {
    if (!eliminar) return
    const tarea =
      eliminar.nivel === 'categoria'
        ? productosApi.cambiarEstadoCategoriaProducto(eliminar.id, false)
        : eliminar.nivel === 'subcategoria'
          ? productosApi.cambiarEstadoSubcategoriaProducto(eliminar.id, false)
          : productosApi.cambiarEstadoTipoProducto(eliminar.id, false)

    tarea
      .then(() => refrescar())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.'))
      .finally(() => setEliminar(null))
  }

  const abrirAgregarCategoria = () => {
    setError('')
    setNombreNuevaCategoria('')
    setAgregandoCategoria(true)
  }
  const cancelarAgregarCategoria = () => setAgregandoCategoria(false)
  const guardarNuevaCategoria = () => {
    if (!nombreNuevaCategoria.trim()) return
    productosApi
      .crearCategoriaProducto(nombreNuevaCategoria.trim())
      .then(() => {
        setAgregandoCategoria(false)
        refrescar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear la categoría.'))
  }

  const abrirAgregarSubcategoria = (id_categoria: number) => {
    setError('')
    setNombreNuevaSubcategoria('')
    setAgregandoSubcategoriaEn(id_categoria)
    setExpandidas((actual) => new Set(actual).add(id_categoria))
  }
  const cancelarAgregarSubcategoria = () => setAgregandoSubcategoriaEn(null)
  const guardarNuevaSubcategoria = () => {
    if (agregandoSubcategoriaEn === null || !nombreNuevaSubcategoria.trim()) return
    productosApi
      .crearSubcategoriaProducto(agregandoSubcategoriaEn, nombreNuevaSubcategoria.trim())
      .then(() => {
        setAgregandoSubcategoriaEn(null)
        refrescar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear la subcategoría.'))
  }

  const abrirAgregarTipo = (id_subcategoria: number) => {
    setError('')
    setNombreNuevoTipo('')
    setObligatorioNuevoTipo(false)
    setAgregandoTipoEn(id_subcategoria)
  }
  const cancelarAgregarTipo = () => setAgregandoTipoEn(null)
  const guardarNuevoTipo = () => {
    if (agregandoTipoEn === null || !nombreNuevoTipo.trim()) return
    productosApi
      .crearTipoProducto(agregandoTipoEn, nombreNuevoTipo.trim(), obligatorioNuevoTipo)
      .then(() => {
        setAgregandoTipoEn(null)
        refrescar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear el tipo de producto.'))
  }

  return (
    <div className="prod-page">
      <div className="prod-toolbar">
        <button type="button" className="prod-add-btn" onClick={abrirAgregarCategoria}>
          <Plus size={16} />
          Añadir categoría
        </button>
      </div>

      {error && <p className="prod-empty prod-error">{error}</p>}

      {agregandoCategoria && (
        <div className="prod-form-row prod-form-row-categoria">
          <input
            type="text"
            autoFocus
            placeholder="Nombre de la nueva categoría"
            value={nombreNuevaCategoria}
            onChange={(e) => setNombreNuevaCategoria(e.target.value)}
          />
          <button type="button" className="prod-icon-btn prod-icon-btn-guardar" onClick={guardarNuevaCategoria} aria-label="Guardar categoría">
            <Save size={15} />
          </button>
          <button type="button" className="prod-icon-btn" onClick={cancelarAgregarCategoria} aria-label="Cancelar">
            <X size={15} />
          </button>
        </div>
      )}

      {cargando ? (
        <p className="prod-empty">Cargando catálogo...</p>
      ) : categorias.length === 0 ? (
        <p className="prod-empty">No se han registrado categorías todavía.</p>
      ) : (
        <div className="prod-lista">
          {categorias.map((cat) => (
            <CategoriaCard
              key={cat.id_categoria}
              categoria={cat}
              expandida={expandidas.has(cat.id_categoria)}
              toggleExpandida={() => toggleExpandida(cat.id_categoria)}
              editando={editando}
              nombreEditado={nombreEditado}
              obligatorioEditado={obligatorioEditado}
              setNombreEditado={setNombreEditado}
              setObligatorioEditado={setObligatorioEditado}
              iniciarEdicion={iniciarEdicion}
              cancelarEdicion={cancelarEdicion}
              guardarEdicion={guardarEdicion}
              toggleActivo={toggleActivo}
              pedirEliminar={pedirEliminar}
              agregandoSubcategoriaEn={agregandoSubcategoriaEn}
              nombreNuevaSubcategoria={nombreNuevaSubcategoria}
              setNombreNuevaSubcategoria={setNombreNuevaSubcategoria}
              abrirAgregarSubcategoria={abrirAgregarSubcategoria}
              cancelarAgregarSubcategoria={cancelarAgregarSubcategoria}
              guardarNuevaSubcategoria={guardarNuevaSubcategoria}
              agregandoTipoEn={agregandoTipoEn}
              nombreNuevoTipo={nombreNuevoTipo}
              obligatorioNuevoTipo={obligatorioNuevoTipo}
              setNombreNuevoTipo={setNombreNuevoTipo}
              setObligatorioNuevoTipo={setObligatorioNuevoTipo}
              abrirAgregarTipo={abrirAgregarTipo}
              cancelarAgregarTipo={cancelarAgregarTipo}
              guardarNuevoTipo={guardarNuevoTipo}
              arrastreCategorias={arrastreCategorias}
              actualizarSubcategorias={actualizarSubcategorias}
              guardarOrdenSubcategorias={guardarOrdenSubcategorias}
              actualizarTipos={actualizarTipos}
              guardarOrdenTipos={guardarOrdenTipos}
            />
          ))}
        </div>
      )}

      <CuadroFlotante arrastre={arrastreCategorias.arrastre} />

      {eliminar && (
        <ConfirmModal
          mensaje={`¿Seguro que desea eliminar "${eliminar.nombre}"?`}
          botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarEliminar, variante: 'rojo' }}
          onClose={cancelarEliminar}
        />
      )}
    </div>
  )
}

interface CategoriaCardProps {
  categoria: CategoriaProductoItem
  expandida: boolean
  toggleExpandida: () => void
  editando: { nivel: NivelEditable; id: number } | null
  nombreEditado: string
  obligatorioEditado: boolean
  setNombreEditado: (v: string) => void
  setObligatorioEditado: (v: boolean) => void
  iniciarEdicion: (nivel: NivelEditable, id: number, nombreActual: string, obligatorioActual?: boolean) => void
  cancelarEdicion: () => void
  guardarEdicion: () => void
  toggleActivo: (nivel: NivelEditable, id: number, activoActual: boolean) => void
  pedirEliminar: (nivel: NivelEditable, id: number, nombre: string) => void

  agregandoSubcategoriaEn: number | null
  nombreNuevaSubcategoria: string
  setNombreNuevaSubcategoria: (v: string) => void
  abrirAgregarSubcategoria: (id_categoria: number) => void
  cancelarAgregarSubcategoria: () => void
  guardarNuevaSubcategoria: () => void

  agregandoTipoEn: number | null
  nombreNuevoTipo: string
  obligatorioNuevoTipo: boolean
  setNombreNuevoTipo: (v: string) => void
  setObligatorioNuevoTipo: (v: boolean) => void
  abrirAgregarTipo: (id_subcategoria: number) => void
  cancelarAgregarTipo: () => void
  guardarNuevoTipo: () => void

  arrastreCategorias: ControladorArrastre<CategoriaProductoItem>
  actualizarSubcategorias: (id_categoria: number, subcategorias: SubcategoriaProductoItem[]) => void
  guardarOrdenSubcategorias: (id_categoria: number, ids: number[]) => void
  actualizarTipos: (id_subcategoria: number, tipos: TipoProductoItem[]) => void
  guardarOrdenTipos: (id_subcategoria: number, ids: number[]) => void
}

function CategoriaCard({
  categoria,
  expandida,
  toggleExpandida,
  editando,
  nombreEditado,
  obligatorioEditado,
  setNombreEditado,
  setObligatorioEditado,
  iniciarEdicion,
  cancelarEdicion,
  guardarEdicion,
  toggleActivo,
  pedirEliminar,
  agregandoSubcategoriaEn,
  nombreNuevaSubcategoria,
  setNombreNuevaSubcategoria,
  abrirAgregarSubcategoria,
  cancelarAgregarSubcategoria,
  guardarNuevaSubcategoria,
  agregandoTipoEn,
  nombreNuevoTipo,
  obligatorioNuevoTipo,
  setNombreNuevoTipo,
  setObligatorioNuevoTipo,
  abrirAgregarTipo,
  cancelarAgregarTipo,
  guardarNuevoTipo,
  arrastreCategorias,
  actualizarSubcategorias,
  guardarOrdenSubcategorias,
  actualizarTipos,
  guardarOrdenTipos,
}: CategoriaCardProps) {
  const estaEditando = editando?.nivel === 'categoria' && editando.id === categoria.id_categoria
  const seEstaArrastrando = arrastreCategorias.arrastre?.id === categoria.id_categoria

  const arrastreSubcategorias = useArrastrarLista(
    `sub-${categoria.id_categoria}`,
    categoria.subcategorias,
    (s) => s.id_subcategoria,
    (s) => s.nombre,
    (subs) => actualizarSubcategorias(categoria.id_categoria, subs),
    (ids) => guardarOrdenSubcategorias(categoria.id_categoria, ids)
  )

  return (
    <div
      data-drag-row={`cat-${categoria.id_categoria}`}
      className={`prod-cat-card ${!categoria.activo ? 'prod-fila-inactiva' : ''} ${seEstaArrastrando ? 'prod-fila-arrastrando' : ''}`}
    >
      <div className="prod-cat-header">
        <span
          className="prod-grip"
          onPointerDown={(e) => arrastreCategorias.iniciar(e, categoria)}
          aria-label="Arrastrar para reordenar categoría"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={15} />
        </span>
        <button type="button" className="prod-expand-btn" onClick={toggleExpandida} aria-label="Expandir">
          {expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {estaEditando ? (
          <input
            type="text"
            autoFocus
            className="prod-nombre-input"
            value={nombreEditado}
            onChange={(e) => setNombreEditado(e.target.value)}
          />
        ) : (
          <span className="prod-cat-nombre" onClick={toggleExpandida}>
            {categoria.nombre}
          </span>
        )}

        <div className="prod-acciones">
          {estaEditando ? (
            <>
              <button type="button" className="prod-icon-btn prod-icon-btn-guardar" onClick={guardarEdicion} aria-label="Guardar">
                <Save size={15} />
              </button>
              <button type="button" className="prod-icon-btn" onClick={cancelarEdicion} aria-label="Cancelar">
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="prod-icon-btn"
                aria-label="Añadir subcategoría"
                title="Añadir subcategoría"
                onClick={() => abrirAgregarSubcategoria(categoria.id_categoria)}
              >
                <Plus size={15} />
              </button>
              <button
                type="button"
                className="prod-icon-btn"
                aria-label="Editar categoría"
                onClick={() => iniciarEdicion('categoria', categoria.id_categoria, categoria.nombre)}
              >
                <SquarePen size={15} />
              </button>
              <button
                type="button"
                className="prod-icon-btn prod-icon-btn-eliminar"
                aria-label="Eliminar categoría"
                onClick={() => pedirEliminar('categoria', categoria.id_categoria, categoria.nombre)}
              >
                <Trash2 size={15} />
              </button>
              <label className="prod-switch">
                <input
                  type="checkbox"
                  checked={categoria.activo}
                  onChange={() => toggleActivo('categoria', categoria.id_categoria, categoria.activo)}
                />
                <span className="prod-switch-slider" />
              </label>
            </>
          )}
        </div>
      </div>

      {expandida && (
        <div className="prod-subcat-lista">
          {categoria.subcategorias.map((sub) => (
            <SubcategoriaRow
              key={sub.id_subcategoria}
              subcategoria={sub}
              editando={editando}
              nombreEditado={nombreEditado}
              obligatorioEditado={obligatorioEditado}
              setNombreEditado={setNombreEditado}
              setObligatorioEditado={setObligatorioEditado}
              iniciarEdicion={iniciarEdicion}
              cancelarEdicion={cancelarEdicion}
              guardarEdicion={guardarEdicion}
              toggleActivo={toggleActivo}
              pedirEliminar={pedirEliminar}
              agregandoTipoEn={agregandoTipoEn}
              nombreNuevoTipo={nombreNuevoTipo}
              obligatorioNuevoTipo={obligatorioNuevoTipo}
              setNombreNuevoTipo={setNombreNuevoTipo}
              setObligatorioNuevoTipo={setObligatorioNuevoTipo}
              abrirAgregarTipo={abrirAgregarTipo}
              cancelarAgregarTipo={cancelarAgregarTipo}
              guardarNuevoTipo={guardarNuevoTipo}
              id_categoria={categoria.id_categoria}
              arrastreSubcategorias={arrastreSubcategorias}
              actualizarTipos={actualizarTipos}
              guardarOrdenTipos={guardarOrdenTipos}
            />
          ))}

          {agregandoSubcategoriaEn === categoria.id_categoria && (
            <div className="prod-form-row prod-form-row-subcategoria">
              <input
                type="text"
                autoFocus
                placeholder="Nombre de la nueva subcategoría"
                value={nombreNuevaSubcategoria}
                onChange={(e) => setNombreNuevaSubcategoria(e.target.value)}
              />
              <button type="button" className="prod-icon-btn prod-icon-btn-guardar" onClick={guardarNuevaSubcategoria} aria-label="Guardar subcategoría">
                <Save size={15} />
              </button>
              <button type="button" className="prod-icon-btn" onClick={cancelarAgregarSubcategoria} aria-label="Cancelar">
                <X size={15} />
              </button>
            </div>
          )}

          {categoria.subcategorias.length === 0 && agregandoSubcategoriaEn !== categoria.id_categoria && (
            <p className="prod-subcat-vacio">Esta categoría todavía no tiene subcategorías.</p>
          )}
        </div>
      )}

      <CuadroFlotante arrastre={arrastreSubcategorias.arrastre} />
    </div>
  )
}

interface SubcategoriaRowProps {
  subcategoria: SubcategoriaProductoItem
  editando: { nivel: NivelEditable; id: number } | null
  nombreEditado: string
  obligatorioEditado: boolean
  setNombreEditado: (v: string) => void
  setObligatorioEditado: (v: boolean) => void
  iniciarEdicion: (nivel: NivelEditable, id: number, nombreActual: string, obligatorioActual?: boolean) => void
  cancelarEdicion: () => void
  guardarEdicion: () => void
  toggleActivo: (nivel: NivelEditable, id: number, activoActual: boolean) => void
  pedirEliminar: (nivel: NivelEditable, id: number, nombre: string) => void

  agregandoTipoEn: number | null
  nombreNuevoTipo: string
  obligatorioNuevoTipo: boolean
  setNombreNuevoTipo: (v: string) => void
  setObligatorioNuevoTipo: (v: boolean) => void
  abrirAgregarTipo: (id_subcategoria: number) => void
  cancelarAgregarTipo: () => void
  guardarNuevoTipo: () => void

  id_categoria: number
  arrastreSubcategorias: ControladorArrastre<SubcategoriaProductoItem>
  actualizarTipos: (id_subcategoria: number, tipos: TipoProductoItem[]) => void
  guardarOrdenTipos: (id_subcategoria: number, ids: number[]) => void
}

function SubcategoriaRow({
  subcategoria,
  editando,
  nombreEditado,
  obligatorioEditado,
  setNombreEditado,
  setObligatorioEditado,
  iniciarEdicion,
  cancelarEdicion,
  guardarEdicion,
  toggleActivo,
  pedirEliminar,
  agregandoTipoEn,
  nombreNuevoTipo,
  obligatorioNuevoTipo,
  setNombreNuevoTipo,
  setObligatorioNuevoTipo,
  abrirAgregarTipo,
  cancelarAgregarTipo,
  guardarNuevoTipo,
  id_categoria,
  arrastreSubcategorias,
  actualizarTipos,
  guardarOrdenTipos,
}: SubcategoriaRowProps) {
  const estaEditando = editando?.nivel === 'subcategoria' && editando.id === subcategoria.id_subcategoria
  const seEstaArrastrando = arrastreSubcategorias.arrastre?.id === subcategoria.id_subcategoria

  const arrastreTipos = useArrastrarLista(
    `tipo-${subcategoria.id_subcategoria}`,
    subcategoria.tipos,
    (t) => t.id_tipo_producto,
    (t) => t.nombre,
    (tipos) => actualizarTipos(subcategoria.id_subcategoria, tipos),
    (ids) => guardarOrdenTipos(subcategoria.id_subcategoria, ids)
  )

  return (
    <div
      data-drag-row={`sub-${id_categoria}-${subcategoria.id_subcategoria}`}
      className={`prod-sub-block ${!subcategoria.activo ? 'prod-fila-inactiva' : ''} ${seEstaArrastrando ? 'prod-fila-arrastrando' : ''}`}
    >
      <div className="prod-sub-header">
        <span
          className="prod-grip"
          onPointerDown={(e) => arrastreSubcategorias.iniciar(e, subcategoria)}
          aria-label="Arrastrar para reordenar subcategoría"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </span>
        {estaEditando ? (
          <input
            type="text"
            autoFocus
            className="prod-nombre-input"
            value={nombreEditado}
            onChange={(e) => setNombreEditado(e.target.value)}
          />
        ) : (
          <span className="prod-sub-nombre">{subcategoria.nombre}</span>
        )}

        <div className="prod-acciones">
          {estaEditando ? (
            <>
              <button type="button" className="prod-icon-btn prod-icon-btn-guardar" onClick={guardarEdicion} aria-label="Guardar">
                <Save size={15} />
              </button>
              <button type="button" className="prod-icon-btn" onClick={cancelarEdicion} aria-label="Cancelar">
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="prod-icon-btn"
                aria-label="Añadir tipo"
                title="Añadir tipo"
                onClick={() => abrirAgregarTipo(subcategoria.id_subcategoria)}
              >
                <Plus size={15} />
              </button>
              <button
                type="button"
                className="prod-icon-btn"
                aria-label="Editar subcategoría"
                onClick={() => iniciarEdicion('subcategoria', subcategoria.id_subcategoria, subcategoria.nombre)}
              >
                <SquarePen size={15} />
              </button>
              <button
                type="button"
                className="prod-icon-btn prod-icon-btn-eliminar"
                aria-label="Eliminar subcategoría"
                onClick={() => pedirEliminar('subcategoria', subcategoria.id_subcategoria, subcategoria.nombre)}
              >
                <Trash2 size={15} />
              </button>
              <label className="prod-switch">
                <input
                  type="checkbox"
                  checked={subcategoria.activo}
                  onChange={() => toggleActivo('subcategoria', subcategoria.id_subcategoria, subcategoria.activo)}
                />
                <span className="prod-switch-slider" />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="prod-tipo-lista">
        {subcategoria.tipos.map((tipo) => (
          <TipoRow
            key={tipo.id_tipo_producto}
            tipo={tipo}
            editando={editando}
            nombreEditado={nombreEditado}
            obligatorioEditado={obligatorioEditado}
            setNombreEditado={setNombreEditado}
            setObligatorioEditado={setObligatorioEditado}
            iniciarEdicion={iniciarEdicion}
            cancelarEdicion={cancelarEdicion}
            guardarEdicion={guardarEdicion}
            toggleActivo={toggleActivo}
            pedirEliminar={pedirEliminar}
            id_subcategoria={subcategoria.id_subcategoria}
            arrastreTipos={arrastreTipos}
          />
        ))}

        {agregandoTipoEn === subcategoria.id_subcategoria && (
          <div className="prod-form-row prod-form-row-tipo">
            <input
              type="text"
              autoFocus
              placeholder="Nombre del nuevo tipo (ej. A1)"
              value={nombreNuevoTipo}
              onChange={(e) => setNombreNuevoTipo(e.target.value)}
            />
            <label className="prod-obligatorio-check">
              <input
                type="checkbox"
                checked={obligatorioNuevoTipo}
                onChange={(e) => setObligatorioNuevoTipo(e.target.checked)}
              />
              Obligatorio
            </label>
            <button type="button" className="prod-icon-btn prod-icon-btn-guardar" onClick={guardarNuevoTipo} aria-label="Guardar tipo">
              <Save size={15} />
            </button>
            <button type="button" className="prod-icon-btn" onClick={cancelarAgregarTipo} aria-label="Cancelar">
              <X size={15} />
            </button>
          </div>
        )}

        {subcategoria.tipos.length === 0 && agregandoTipoEn !== subcategoria.id_subcategoria && (
          <p className="prod-subcat-vacio">Esta subcategoría todavía no tiene tipos.</p>
        )}
      </div>

      <CuadroFlotante arrastre={arrastreTipos.arrastre} />
    </div>
  )
}

interface TipoRowProps {
  tipo: TipoProductoItem
  editando: { nivel: NivelEditable; id: number } | null
  nombreEditado: string
  obligatorioEditado: boolean
  setNombreEditado: (v: string) => void
  setObligatorioEditado: (v: boolean) => void
  iniciarEdicion: (nivel: NivelEditable, id: number, nombreActual: string, obligatorioActual?: boolean) => void
  cancelarEdicion: () => void
  guardarEdicion: () => void
  toggleActivo: (nivel: NivelEditable, id: number, activoActual: boolean) => void
  pedirEliminar: (nivel: NivelEditable, id: number, nombre: string) => void

  id_subcategoria: number
  arrastreTipos: ControladorArrastre<TipoProductoItem>
}

function TipoRow({
  tipo,
  editando,
  nombreEditado,
  obligatorioEditado,
  setNombreEditado,
  setObligatorioEditado,
  iniciarEdicion,
  cancelarEdicion,
  guardarEdicion,
  toggleActivo,
  pedirEliminar,
  id_subcategoria,
  arrastreTipos,
}: TipoRowProps) {
  const estaEditando = editando?.nivel === 'tipo' && editando.id === tipo.id_tipo_producto
  const seEstaArrastrando = arrastreTipos.arrastre?.id === tipo.id_tipo_producto

  return (
    <div
      data-drag-row={`tipo-${id_subcategoria}-${tipo.id_tipo_producto}`}
      className={`prod-tipo-row ${!tipo.activo ? 'prod-fila-inactiva' : ''} ${seEstaArrastrando ? 'prod-fila-arrastrando' : ''}`}
    >
      <span
        className="prod-grip"
        onPointerDown={(e) => arrastreTipos.iniciar(e, tipo)}
        aria-label="Arrastrar para reordenar tipo"
        title="Arrastrar para reordenar"
      >
        <GripVertical size={13} />
      </span>
      {estaEditando ? (
        <input
          type="text"
          autoFocus
          className="prod-nombre-input"
          value={nombreEditado}
          onChange={(e) => setNombreEditado(e.target.value)}
        />
      ) : (
        <span className="prod-tipo-nombre">{tipo.nombre}</span>
      )}

      {estaEditando ? (
        <label className="prod-obligatorio-check">
          <input
            type="checkbox"
            checked={obligatorioEditado}
            onChange={(e) => setObligatorioEditado(e.target.checked)}
          />
          Obligatorio
        </label>
      ) : (
        tipo.obligatorio && <span className="prod-obligatorio-badge">Obligatorio</span>
      )}

      <div className="prod-acciones">
        {estaEditando ? (
          <>
            <button type="button" className="prod-icon-btn prod-icon-btn-guardar" onClick={guardarEdicion} aria-label="Guardar">
              <Save size={15} />
            </button>
            <button type="button" className="prod-icon-btn" onClick={cancelarEdicion} aria-label="Cancelar">
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="prod-icon-btn"
              aria-label="Editar tipo"
              onClick={() => iniciarEdicion('tipo', tipo.id_tipo_producto, tipo.nombre, tipo.obligatorio)}
            >
              <SquarePen size={15} />
            </button>
            <button
              type="button"
              className="prod-icon-btn prod-icon-btn-eliminar"
              aria-label="Eliminar tipo"
              onClick={() => pedirEliminar('tipo', tipo.id_tipo_producto, tipo.nombre)}
            >
              <Trash2 size={15} />
            </button>
            <label className="prod-switch">
              <input
                type="checkbox"
                checked={tipo.activo}
                onChange={() => toggleActivo('tipo', tipo.id_tipo_producto, tipo.activo)}
              />
              <span className="prod-switch-slider" />
            </label>
          </>
        )}
      </div>
    </div>
  )
}

export default ResultadosEsperadosTab
