import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Save, ArrowLeft, Plus, SquarePen, Trash2, Check, X as XIcon } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as gruposApi from '../../proyectos/api/grupos'
import * as productosApi from '../../proyectos/api/productos'
import * as opcionesApi from '../api/convocatoriaOpciones'
import type { TipoOpcionConvocatoria } from '../api/convocatoriaOpciones'
import { getLimites, getLimiteAntecedentes, type ClaveLimiteTexto } from '../../proyectos/lib/limitesTexto'
import { ApiError } from '../../../shared/api/client'
import './ConfigurarOpcionesConvocatoria.css'

interface ItemCatalogo {
  id: number
  nombre: string
  activo: boolean
}

interface DefinicionSeccion {
  tipo: TipoOpcionConvocatoria
  etiqueta: string
}

const DEFINICIONES: DefinicionSeccion[] = [
  { tipo: 'periodo', etiqueta: 'Periodos' },
  { tipo: 'programa', etiqueta: 'Programas académicos' },
  { tipo: 'facultad', etiqueta: 'Facultades' },
  { tipo: 'grupo', etiqueta: 'Grupos de investigación internos' },
  { tipo: 'linea', etiqueta: 'Líneas de investigación' },
  { tipo: 'ods', etiqueta: 'ODS' },
  { tipo: 'area', etiqueta: 'Áreas de conocimiento' },
  { tipo: 'modalidad', etiqueta: 'Modalidad de proyecto' },
  { tipo: 'tipo_proyecto', etiqueta: 'Tipo de proyecto' },
  { tipo: 'categoria_producto', etiqueta: 'Resultados esperados (categorías)' },
]

/** "Resultados esperados" no tiene endpoint de borrado (ver productos.ts): solo activar/desactivar. */
function puedeEliminar(tipo: TipoOpcionConvocatoria): boolean {
  return tipo !== 'categoria_producto'
}

async function cargarItems(tipo: TipoOpcionConvocatoria): Promise<ItemCatalogo[]> {
  switch (tipo) {
    case 'periodo':
      return (await catalogosApi.listarPeriodos()).map((p) => ({ id: p.id_periodo, nombre: p.nombre, activo: p.activo }))
    case 'programa':
      return (await catalogosApi.listarProgramas()).map((p) => ({ id: p.id_programa, nombre: p.nombre, activo: p.activo }))
    case 'facultad':
      return (await catalogosApi.listarFacultades()).map((f) => ({ id: f.id_facultad, nombre: f.nombre, activo: f.activo }))
    case 'grupo':
      return (await gruposApi.listarGrupos()).map((g) => ({ id: g.id_grupo, nombre: g.nombre, activo: g.activo }))
    case 'linea':
      return (await catalogosApi.listarLineasInvestigacion()).map((l) => ({ id: l.id_linea, nombre: l.nombre, activo: l.activa }))
    case 'ods':
      return (await catalogosApi.listarOds()).map((o) => ({ id: o.id_ods, nombre: o.nombre, activo: o.activo }))
    case 'area':
      return (await catalogosApi.listarAreasConocimiento()).map((a) => ({
        id: a.id_area_conocimiento,
        nombre: a.nombre,
        activo: a.activo,
      }))
    case 'modalidad':
      return (await catalogosApi.listarModalidadesProyecto()).map((m) => ({ id: m.id_modalidad, nombre: m.nombre, activo: m.activo }))
    case 'tipo_proyecto':
      return (await catalogosApi.listarTiposProyecto()).map((t) => ({
        id: t.id_tipo_proyecto,
        nombre: t.nombre,
        activo: t.activo,
      }))
    case 'categoria_producto':
      return (await productosApi.listarCategoriasProducto()).map((c) => ({ id: c.id_categoria, nombre: c.nombre, activo: c.activo }))
  }
}

interface DatosNuevoPrograma {
  id_facultad: number
  id_tipo_programa: number
}

/** Crea un elemento nuevo en el catálogo real (no solo en la convocatoria) y devuelve su id. */
async function crearItemCatalogo(
  tipo: TipoOpcionConvocatoria,
  nombre: string,
  datosPrograma?: DatosNuevoPrograma
): Promise<number> {
  switch (tipo) {
    case 'periodo':
      return (await catalogosApi.crearPeriodo(nombre)).registro.id_periodo
    case 'programa': {
      if (!datosPrograma) throw new Error('Selecciona una facultad y un tipo de programa.')
      return (await catalogosApi.crearPrograma(nombre, datosPrograma.id_facultad, datosPrograma.id_tipo_programa)).registro
        .id_programa
    }
    case 'facultad':
      return (await catalogosApi.crearFacultad(nombre)).registro.id_facultad
    case 'grupo': {
      const tiposGrupo = await catalogosApi.listarTiposGrupo()
      const idInterno = tiposGrupo.find((t) => t.nombre === 'interno')?.id_tipo_grupo
      if (!idInterno) throw new Error('El tipo de grupo "interno" no existe en el catálogo.')
      return (await gruposApi.crearGrupo({ nombre, id_tipo_grupo: idInterno })).grupo.id_grupo
    }
    case 'linea':
      return (await catalogosApi.crearLineaInvestigacion(nombre)).registro.id_linea
    case 'ods':
      return (await catalogosApi.crearOds(nombre)).registro.id_ods
    case 'area':
      return (await catalogosApi.crearAreaConocimiento(nombre)).registro.id_area_conocimiento
    case 'modalidad':
      return (await catalogosApi.crearModalidadProyecto(nombre)).registro.id_modalidad!
    case 'tipo_proyecto':
      return (await catalogosApi.crearTipoProyecto(nombre)).registro.id_tipo_proyecto!
    case 'categoria_producto':
      return (await productosApi.crearCategoriaProducto(nombre)).registro.id_categoria
  }
}

async function renombrarItemCatalogo(tipo: TipoOpcionConvocatoria, id: number, nombre: string): Promise<void> {
  switch (tipo) {
    case 'periodo':
      await catalogosApi.actualizarPeriodo(id, nombre)
      return
    case 'programa':
      await catalogosApi.actualizarPrograma(id, nombre)
      return
    case 'facultad':
      await catalogosApi.actualizarFacultad(id, nombre)
      return
    case 'grupo':
      await gruposApi.actualizarGrupo(id, nombre)
      return
    case 'linea':
      await catalogosApi.actualizarLineaInvestigacion(id, nombre)
      return
    case 'ods':
      await catalogosApi.actualizarOds(id, nombre)
      return
    case 'area':
      await catalogosApi.actualizarAreaConocimiento(id, nombre)
      return
    case 'modalidad':
      await catalogosApi.actualizarModalidadProyecto(id, nombre)
      return
    case 'tipo_proyecto':
      await catalogosApi.actualizarTipoProyecto(id, nombre)
      return
    case 'categoria_producto':
      await productosApi.actualizarCategoriaProducto(id, nombre)
      return
  }
}

async function cambiarEstadoItemCatalogo(tipo: TipoOpcionConvocatoria, id: number, activo: boolean): Promise<void> {
  switch (tipo) {
    case 'periodo':
      await catalogosApi.cambiarEstadoPeriodo(id, activo)
      return
    case 'programa':
      await catalogosApi.cambiarEstadoPrograma(id, activo)
      return
    case 'facultad':
      await catalogosApi.cambiarEstadoFacultad(id, activo)
      return
    case 'grupo':
      await gruposApi.cambiarEstadoGrupo(id, activo)
      return
    case 'linea':
      await catalogosApi.cambiarEstadoLineaInvestigacion(id, activo)
      return
    case 'ods':
      await catalogosApi.cambiarEstadoOds(id, activo)
      return
    case 'area':
      await catalogosApi.cambiarEstadoAreaConocimiento(id, activo)
      return
    case 'modalidad':
      await catalogosApi.cambiarEstadoModalidadProyecto(id, activo)
      return
    case 'tipo_proyecto':
      await catalogosApi.cambiarEstadoTipoProyecto(id, activo)
      return
    case 'categoria_producto':
      await productosApi.cambiarEstadoCategoriaProducto(id, activo)
      return
  }
}

/** Borrado real del catálogo: el backend rechaza con 409 si algo ya usa ese elemento. */
async function eliminarItemCatalogo(tipo: TipoOpcionConvocatoria, id: number): Promise<void> {
  switch (tipo) {
    case 'periodo':
      await catalogosApi.eliminarPeriodo(id)
      return
    case 'programa':
      await catalogosApi.eliminarPrograma(id)
      return
    case 'facultad':
      await catalogosApi.eliminarFacultad(id)
      return
    case 'grupo':
      await gruposApi.eliminarGrupo(id)
      return
    case 'linea':
      await catalogosApi.eliminarLineaInvestigacion(id)
      return
    case 'ods':
      await catalogosApi.eliminarOds(id)
      return
    case 'area':
      await catalogosApi.eliminarAreaConocimiento(id)
      return
    case 'modalidad':
      await catalogosApi.eliminarModalidadProyecto(id)
      return
    case 'tipo_proyecto':
      await catalogosApi.eliminarTipoProyecto(id)
      return
    case 'categoria_producto':
      throw new Error('No se puede eliminar una categoría de resultados esperados.')
  }
}

interface SeleccionTipo {
  restringido: boolean
  ids: Set<number>
}

function seleccionInicial(): Record<TipoOpcionConvocatoria, SeleccionTipo> {
  const inicial = {} as Record<TipoOpcionConvocatoria, SeleccionTipo>
  for (const { tipo } of DEFINICIONES) inicial[tipo] = { restringido: false, ids: new Set() }
  return inicial
}

const ETIQUETAS_LIMITES: { clave: ClaveLimiteTexto; etiqueta: string }[] = [
  { clave: 'resumen', etiqueta: 'Resumen' },
  { clave: 'planteamientoProblema', etiqueta: 'Planteamiento del problema' },
  { clave: 'preguntaInvestigacion', etiqueta: 'Pregunta de investigación' },
  { clave: 'justificacion', etiqueta: 'Justificación' },
  { clave: 'objetivoGeneral', etiqueta: 'Objetivo general' },
  { clave: 'objetivoEspecifico', etiqueta: 'Objetivo específico (cada uno)' },
  { clave: 'antecedente', etiqueta: 'Antecedente (cada uno)' },
  { clave: 'referencia', etiqueta: 'Referencia (cada una)' },
  { clave: 'marcoTeorico', etiqueta: 'Marco teórico preliminar' },
  { clave: 'metodologia', etiqueta: 'Metodología preliminar propuesta' },
  { clave: 'componenteEtico', etiqueta: 'Componente ético' },
  { clave: 'funcionesEstudiante', etiqueta: 'Funciones del estudiante auxiliar/asistente' },
]

const CLAVE_ANTECEDENTES_CANTIDAD = 'antecedentesCantidad'

interface ItemEditando {
  tipo: TipoOpcionConvocatoria
  id: number
  nombre: string
}

interface ItemAEliminar {
  tipo: TipoOpcionConvocatoria
  id: number
  nombre: string
}

interface ConfigurarOpcionesConvocatoriaProps {
  id_convocatoria: number
  onFinalizar: () => void
  onCancelar: () => void
}

function ConfigurarOpcionesConvocatoria({ id_convocatoria, onFinalizar, onCancelar }: ConfigurarOpcionesConvocatoriaProps) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [items, setItems] = useState<Record<TipoOpcionConvocatoria, ItemCatalogo[]>>(
    () => ({}) as Record<TipoOpcionConvocatoria, ItemCatalogo[]>
  )
  const [seleccion, setSeleccion] = useState<Record<TipoOpcionConvocatoria, SeleccionTipo>>(seleccionInicial())
  const [limites, setLimites] = useState<Record<string, number>>({})
  const [expandida, setExpandida] = useState<Set<TipoOpcionConvocatoria>>(new Set())

  const [tiposPrograma, setTiposPrograma] = useState<catalogosApi.TipoProgramaItem[]>([])
  const [nombreNuevoItem, setNombreNuevoItem] = useState<Record<string, string>>({})
  const [facultadNuevoPrograma, setFacultadNuevoPrograma] = useState<number | null>(null)
  const [tipoProgramaNuevo, setTipoProgramaNuevo] = useState<'pregrado' | 'posgrado'>('pregrado')

  const [editando, setEditando] = useState<ItemEditando | null>(null)
  const [eliminarPendiente, setEliminarPendiente] = useState<ItemAEliminar | null>(null)
  const [accionEnCurso, setAccionEnCurso] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const cargarTodo = () => {
    setCargando(true)
    setError('')

    Promise.all([
      Promise.all(DEFINICIONES.map(({ tipo }) => cargarItems(tipo).then((lista) => [tipo, lista] as const))),
      opcionesApi.obtenerOpciones(id_convocatoria),
      opcionesApi.obtenerLimitesTexto(id_convocatoria),
      catalogosApi.listarTiposPrograma(),
    ])
      .then(([listas, opcionesGuardadas, limitesGuardados, tiposProgramaRes]) => {
        const itemsCargados = {} as Record<TipoOpcionConvocatoria, ItemCatalogo[]>
        for (const [tipo, lista] of listas) itemsCargados[tipo] = lista
        setItems(itemsCargados)
        setTiposPrograma(tiposProgramaRes)

        const nuevaSeleccion = seleccionInicial()
        for (const { tipo } of DEFINICIONES) {
          const idsGuardados = opcionesGuardadas[tipo]
          if (idsGuardados && idsGuardados.length > 0) {
            nuevaSeleccion[tipo] = { restringido: true, ids: new Set(idsGuardados) }
          }
        }
        setSeleccion(nuevaSeleccion)

        const limitesPorClave = new Map(limitesGuardados.map((l) => [l.clave, l.max_caracteres]))
        const nuevosLimites: Record<string, number> = {}
        for (const { clave } of ETIQUETAS_LIMITES) {
          nuevosLimites[clave] = limitesPorClave.get(clave) ?? getLimites().find((l) => l.clave === clave)!.maxCaracteres
        }
        nuevosLimites[CLAVE_ANTECEDENTES_CANTIDAD] =
          limitesPorClave.get(CLAVE_ANTECEDENTES_CANTIDAD) ?? getLimiteAntecedentes()
        setLimites(nuevosLimites)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id_convocatoria])

  const refrescarTipo = (tipo: TipoOpcionConvocatoria) => {
    return cargarItems(tipo).then((lista) => setItems((actual) => ({ ...actual, [tipo]: lista })))
  }

  const toggleExpandida = (tipo: TipoOpcionConvocatoria) => {
    setExpandida((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(tipo)) nuevo.delete(tipo)
      else nuevo.add(tipo)
      return nuevo
    })
  }

  const toggleRestriccion = (tipo: TipoOpcionConvocatoria) => {
    setSeleccion((actual) => ({
      ...actual,
      [tipo]: { ...actual[tipo], restringido: !actual[tipo].restringido },
    }))
  }

  const toggleItemSeleccionado = (tipo: TipoOpcionConvocatoria, id: number) => {
    setSeleccion((actual) => {
      const ids = new Set(actual[tipo].ids)
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
      return { ...actual, [tipo]: { ...actual[tipo], ids } }
    })
  }

  const quitarDeSeleccion = (tipo: TipoOpcionConvocatoria, id: number) => {
    setSeleccion((actual) => {
      const ids = new Set(actual[tipo].ids)
      ids.delete(id)
      return { ...actual, [tipo]: { ...actual[tipo], ids } }
    })
  }

  const handleAgregarItem = (tipo: TipoOpcionConvocatoria) => {
    const nombre = (nombreNuevoItem[tipo] ?? '').trim()
    if (!nombre) return
    setErrorAccion('')
    setAccionEnCurso(true)

    const datosPrograma =
      tipo === 'programa' && facultadNuevoPrograma
        ? {
          id_facultad: facultadNuevoPrograma,
          id_tipo_programa: tiposPrograma.find((t) => t.nombre === tipoProgramaNuevo)?.id_tipo_programa ?? 0,
        }
        : undefined

    crearItemCatalogo(tipo, nombre, datosPrograma)
      .then(() => {
        setNombreNuevoItem((actual) => ({ ...actual, [tipo]: '' }))
        return refrescarTipo(tipo)
      })
      .catch((err) => setErrorAccion(err instanceof ApiError ? err.message : err.message || 'No se pudo crear el elemento.'))
      .finally(() => setAccionEnCurso(false))
  }

  const abrirEditar = (tipo: TipoOpcionConvocatoria, item: ItemCatalogo) => {
    setErrorAccion('')
    setEditando({ tipo, id: item.id, nombre: item.nombre })
  }

  const guardarEdicion = () => {
    if (!editando) return
    const nombre = editando.nombre.trim()
    if (!nombre) return
    setAccionEnCurso(true)
    setErrorAccion('')

    renombrarItemCatalogo(editando.tipo, editando.id, nombre)
      .then(() => {
        const tipo = editando.tipo
        setEditando(null)
        return refrescarTipo(tipo)
      })
      .catch((err) => setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo editar el elemento.'))
      .finally(() => setAccionEnCurso(false))
  }

  const handleToggleEstado = (tipo: TipoOpcionConvocatoria, item: ItemCatalogo) => {
    setErrorAccion('')
    setAccionEnCurso(true)
    cambiarEstadoItemCatalogo(tipo, item.id, !item.activo)
      .then(() => refrescarTipo(tipo))
      .catch((err) => setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.'))
      .finally(() => setAccionEnCurso(false))
  }

  const confirmarEliminar = () => {
    if (!eliminarPendiente) return
    const { tipo, id } = eliminarPendiente
    setAccionEnCurso(true)
    setErrorAccion('')

    eliminarItemCatalogo(tipo, id)
      .then(() => {
        quitarDeSeleccion(tipo, id)
        return refrescarTipo(tipo)
      })
      .catch((err) => setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo eliminar el elemento.'))
      .finally(() => {
        setAccionEnCurso(false)
        setEliminarPendiente(null)
      })
  }

  const handleGuardar = () => {
    setGuardando(true)
    setError('')

    const limitesLista = Object.entries(limites).map(([clave, max_caracteres]) => ({ clave, max_caracteres }))

    Promise.all([
      ...DEFINICIONES.map(({ tipo }) =>
        opcionesApi.reemplazarOpciones(
          id_convocatoria,
          tipo,
          seleccion[tipo].restringido ? [...seleccion[tipo].ids] : []
        )
      ),
      opcionesApi.reemplazarLimitesTexto(id_convocatoria, limitesLista),
    ])
      .then(() => onFinalizar())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración.'))
      .finally(() => setGuardando(false))
  }

  if (cargando) {
    return <p className="cop-cargando">Cargando configuración de la convocatoria...</p>
  }

  const facultadesActivas = (items.facultad ?? []).filter((f) => f.activo)

  return (
    <div className="cop-wrapper">
      <div className="cop-panel">
        <h3 className="cop-titulo">Configurar opciones para esta convocatoria</h3>
        <p className="cop-subtitulo">
          Cada catálogo está sin restricción por defecto: el investigador ve todas las opciones activas. Puedes
          añadir, editar, activar/desactivar o eliminar elementos del catálogo aquí mismo, y restringir esta
          convocatoria a un subconjunto específico si lo necesitas.
        </p>

        {DEFINICIONES.map(({ tipo, etiqueta }) => {
          const lista = items[tipo] ?? []
          const sel = seleccion[tipo]
          return (
            <div className="cop-seccion" key={tipo}>
              <button type="button" className="cop-seccion-header" onClick={() => toggleExpandida(tipo)}>
                {expandida.has(tipo) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="cop-seccion-nombre">{etiqueta}</span>
                <span className="cop-seccion-resumen">
                  {sel.restringido ? `${sel.ids.size} de ${lista.length} seleccionados` : `Todos (${lista.length}) — sin restricción`}
                </span>
              </button>

              {expandida.has(tipo) && (
                <div className="cop-seccion-body">
                  <label className="cop-switch-restriccion">
                    <input type="checkbox" checked={sel.restringido} onChange={() => toggleRestriccion(tipo)} />
                    <span>Restringir esta convocatoria a elementos específicos</span>
                  </label>

                  <div className="cop-items-lista">
                    {lista.map((item) => (
                      <div className="cop-item-fila" key={item.id}>
                        {sel.restringido && (
                          <input
                            type="checkbox"
                            checked={sel.ids.has(item.id)}
                            onChange={() => toggleItemSeleccionado(tipo, item.id)}
                          />
                        )}

                        {editando?.tipo === tipo && editando.id === item.id ? (
                          <>
                            <input
                              type="text"
                              className="cop-item-input-editar"
                              value={editando.nombre}
                              onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                            />
                            <button type="button" onClick={guardarEdicion} disabled={accionEnCurso} aria-label="Guardar">
                              <Check size={14} />
                            </button>
                            <button type="button" onClick={() => setEditando(null)} disabled={accionEnCurso} aria-label="Cancelar">
                              <XIcon size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className={`cop-item-nombre${item.activo ? '' : ' cop-item-inactivo'}`}>{item.nombre}</span>
                            <button
                              type="button"
                              onClick={() => abrirEditar(tipo, item)}
                              disabled={accionEnCurso}
                              aria-label={`Editar ${item.nombre}`}
                            >
                              <SquarePen size={14} />
                            </button>
                            {puedeEliminar(tipo) && (
                              <button
                                type="button"
                                onClick={() => setEliminarPendiente({ tipo, id: item.id, nombre: item.nombre })}
                                disabled={accionEnCurso}
                                aria-label={`Eliminar ${item.nombre}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            <label className="cop-item-switch">
                              <input
                                type="checkbox"
                                checked={item.activo}
                                onChange={() => handleToggleEstado(tipo, item)}
                                disabled={accionEnCurso}
                              />
                              <span />
                            </label>
                          </>
                        )}
                      </div>
                    ))}
                    {lista.length === 0 && <p className="cop-items-vacio">Este catálogo todavía no tiene elementos.</p>}
                  </div>

                  <div className="cop-item-nuevo">
                    {tipo === 'programa' && (
                      <>
                        <select
                          value={facultadNuevoPrograma ?? ''}
                          onChange={(e) => setFacultadNuevoPrograma(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">Selecciona facultad</option>
                          {facultadesActivas.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nombre}
                            </option>
                          ))}
                        </select>
                        <select value={tipoProgramaNuevo} onChange={(e) => setTipoProgramaNuevo(e.target.value as 'pregrado' | 'posgrado')}>
                          <option value="pregrado">Pregrado</option>
                          <option value="posgrado">Posgrado</option>
                        </select>
                      </>
                    )}
                    <input
                      type="text"
                      placeholder={`Nombre del nuevo ${etiqueta.toLowerCase()}...`}
                      value={nombreNuevoItem[tipo] ?? ''}
                      onChange={(e) => setNombreNuevoItem((actual) => ({ ...actual, [tipo]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="cop-item-agregar-btn"
                      onClick={() => handleAgregarItem(tipo)}
                      disabled={accionEnCurso || (tipo === 'programa' && !facultadNuevoPrograma)}
                    >
                      <Plus size={14} />
                      Añadir
                    </button>
                  </div>

                  {errorAccion && <p className="cop-error">{errorAccion}</p>}
                </div>
              )}
            </div>
          )
        })}

        <div className="cop-seccion">
          <button type="button" className="cop-seccion-header" onClick={() => toggleExpandida('limites' as TipoOpcionConvocatoria)}>
            {expandida.has('limites' as TipoOpcionConvocatoria) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="cop-seccion-nombre">Límites de texto</span>
            <span className="cop-seccion-resumen">{ETIQUETAS_LIMITES.length + 1} campos configurables</span>
          </button>

          {expandida.has('limites' as TipoOpcionConvocatoria) && (
            <div className="cop-seccion-body">
              <div className="cop-limites-grid">
                {ETIQUETAS_LIMITES.map(({ clave, etiqueta }) => (
                  <label key={clave} className="cop-limite-campo">
                    <span>{etiqueta}</span>
                    <input
                      type="number"
                      min={1}
                      value={limites[clave] ?? ''}
                      onChange={(e) => setLimites((actual) => ({ ...actual, [clave]: Number(e.target.value) || 1 }))}
                    />
                  </label>
                ))}
                <label className="cop-limite-campo">
                  <span>Cantidad máxima de antecedentes</span>
                  <input
                    type="number"
                    min={1}
                    value={limites[CLAVE_ANTECEDENTES_CANTIDAD] ?? ''}
                    onChange={(e) =>
                      setLimites((actual) => ({ ...actual, [CLAVE_ANTECEDENTES_CANTIDAD]: Number(e.target.value) || 1 }))
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {error && <p className="cop-error">{error}</p>}

        <div className="cop-acciones">
          <button type="button" className="cop-volver-btn" onClick={onCancelar} disabled={guardando}>
            <ArrowLeft size={16} />
            Volver
          </button>
          <button type="button" className="cop-guardar-btn" onClick={handleGuardar} disabled={guardando}>
            <Save size={16} />
            {guardando ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>

      <div className="cop-preview">
        <h3 className="cop-preview-titulo">Vista previa: así verá esta convocatoria el investigador</h3>
        <ul className="cop-preview-lista">
          {DEFINICIONES.map(({ tipo, etiqueta }) => {
            const lista = items[tipo] ?? []
            const sel = seleccion[tipo]
            return (
              <li key={tipo}>
                <strong>{etiqueta}:</strong>{' '}
                {sel.restringido ? `${sel.ids.size} de ${lista.length} disponibles` : `Todas (${lista.length}), sin restricción`}
              </li>
            )
          })}
        </ul>
      </div>

      {eliminarPendiente && (
        <ConfirmModal
          mensaje={`¿Seguro que desea eliminar "${eliminarPendiente.nombre}" del catálogo? Esto lo afecta para todas las convocatorias.`}
          botonSecundario={{ label: 'No', onClick: () => setEliminarPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
          onClose={() => setEliminarPendiente(null)}
        />
      )}
    </div>
  )
}

export default ConfigurarOpcionesConvocatoria
