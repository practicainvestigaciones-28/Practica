import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, SquarePen, Save, X } from 'lucide-react'
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
            />
          ))}
        </div>
      )}

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
}: CategoriaCardProps) {
  const estaEditando = editando?.nivel === 'categoria' && editando.id === categoria.id_categoria

  return (
    <div className={`prod-cat-card ${!categoria.activo ? 'prod-fila-inactiva' : ''}`}>
      <div className="prod-cat-header">
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
}: SubcategoriaRowProps) {
  const estaEditando = editando?.nivel === 'subcategoria' && editando.id === subcategoria.id_subcategoria

  return (
    <div className={`prod-sub-block ${!subcategoria.activo ? 'prod-fila-inactiva' : ''}`}>
      <div className="prod-sub-header">
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
}: TipoRowProps) {
  const estaEditando = editando?.nivel === 'tipo' && editando.id === tipo.id_tipo_producto

  return (
    <div className={`prod-tipo-row ${!tipo.activo ? 'prod-fila-inactiva' : ''}`}>
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
