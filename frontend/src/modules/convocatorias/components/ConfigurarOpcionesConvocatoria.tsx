import { useEffect, useState } from 'react'
import { Save, ArrowLeft, Plus, SquarePen, Trash2, Check, X as XIcon, GripVertical } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import CuadroFlotante from '../../../shared/components/common/CuadroFlotanteArrastre'
import { useArrastrarLista } from '../../../shared/hooks/useArrastrarLista'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as gruposApi from '../../proyectos/api/grupos'
import * as productosApi from '../../proyectos/api/productos'
import * as opcionesApi from '../api/convocatoriaOpciones'
import type { TipoOpcionConvocatoria } from '../api/convocatoriaOpciones'
import { getLimites, getLimiteAntecedentes, type ClaveLimiteTexto } from '../../proyectos/lib/limitesTexto'
import {
  getLineas as getLineasMedularesLocal,
  addLinea as addLineaMedularLocal,
  editarLinea as editarLineaMedularLocal,
  eliminarLinea as eliminarLineaMedularLocal,
  toggleLineaActiva as toggleLineaMedularLocal,
  reordenarLineas as reordenarLineasMedularesLocal,
  type Linea as LineaMedularLocal,
} from '../lib/lineasInvestigacion'
import ResultadosEsperadosTab from './ResultadosEsperadosTab'
import { ApiError } from '../../../shared/api/client'
import './ConfigurarOpcionesConvocatoria.css'

interface ItemCatalogo {
  id: number
  nombre: string
  activo: boolean
  descripcion?: string | null
  tipoProgramaNombre?: string
}

/** Forma mínima que necesita el hook de arrastrar y soltar (ver ItemCatalogo y LineaMedularLocal). */
interface ItemArrastrable {
  id: number
  nombre: string
}

interface DefinicionSeccion {
  tipo: TipoOpcionConvocatoria
  etiqueta: string
}

const DEFINICIONES: DefinicionSeccion[] = [
  { tipo: 'periodo', etiqueta: 'Periodos' },
  { tipo: 'facultad', etiqueta: 'Facultad' },
  { tipo: 'programa', etiqueta: 'Programas académicos' },
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
      return (await catalogosApi.listarProgramas()).map((p) => ({
        id: p.id_programa,
        nombre: p.nombre,
        activo: p.activo,
        tipoProgramaNombre: p.tipoPrograma?.nombre,
      }))
    case 'facultad':
      return (await catalogosApi.listarFacultades()).map((f) => ({ id: f.id_facultad, nombre: f.nombre, activo: f.activo }))
    case 'grupo':
      return (await gruposApi.listarGrupos()).map((g) => ({ id: g.id_grupo, nombre: g.nombre, activo: g.activo }))
    case 'linea':
      return (await catalogosApi.listarLineasInvestigacion()).map((l) => ({ id: l.id_linea, nombre: l.nombre, activo: l.activa }))
    case 'ods':
      return (await catalogosApi.listarOds()).map((o) => ({ id: o.id_ods, nombre: o.nombre, activo: o.activo, descripcion: o.descripcion }))
    case 'area':
      return (await catalogosApi.listarAreasConocimiento()).map((a) => ({
        id: a.id_area_conocimiento,
        nombre: a.nombre,
        activo: a.activo,
        descripcion: a.descripcion,
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
  datosPrograma?: DatosNuevoPrograma,
  descripcion?: string
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
      return (await catalogosApi.crearOds(nombre, descripcion)).registro.id_ods
    case 'area':
      return (await catalogosApi.crearAreaConocimiento(nombre, descripcion)).registro.id_area_conocimiento
    case 'modalidad':
      return (await catalogosApi.crearModalidadProyecto(nombre)).registro.id_modalidad!
    case 'tipo_proyecto':
      return (await catalogosApi.crearTipoProyecto(nombre)).registro.id_tipo_proyecto!
    case 'categoria_producto':
      return (await productosApi.crearCategoriaProducto(nombre)).registro.id_categoria
  }
}

async function renombrarItemCatalogo(tipo: TipoOpcionConvocatoria, id: number, nombre: string, descripcion?: string): Promise<void> {
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
      await catalogosApi.actualizarAreaConocimiento(id, nombre, descripcion)
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
  descripcion?: string
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

type TabConfig = TipoOpcionConvocatoria | 'limites'

function ConfigurarOpcionesConvocatoria({ id_convocatoria, onFinalizar, onCancelar }: ConfigurarOpcionesConvocatoriaProps) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [items, setItems] = useState<Record<TipoOpcionConvocatoria, ItemCatalogo[]>>(
    () => ({}) as Record<TipoOpcionConvocatoria, ItemCatalogo[]>
  )
  const [limites, setLimites] = useState<Record<string, number>>({})
  // Lo último guardado (o cargado): solo los límites de texto se quedan en
  // memoria hasta que se le da "Guardar" — el resto de pestañas (facultad,
  // programas, etc.) ya escriben en el backend con cada acción. Comparando
  // contra esto se sabe si "Volver" perdería algo sin preguntar.
  const [limitesGuardados, setLimitesGuardados] = useState<Record<string, number>>({})
  const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false)
  const [tabActivo, setTabActivo] = useState<TabConfig>(DEFINICIONES[0].tipo)

  const [tiposPrograma, setTiposPrograma] = useState<catalogosApi.TipoProgramaItem[]>([])
  const [nombreNuevoItem, setNombreNuevoItem] = useState<Record<string, string>>({})
  const [descripcionNuevoItem, setDescripcionNuevoItem] = useState<Record<string, string>>({})
  const [facultadNuevoPrograma, setFacultadNuevoPrograma] = useState<number | null>(null)
  const [progSubTab, setProgSubTab] = useState<'pregrado' | 'posgrado'>('pregrado')

  const [lineaSubTab, setLineaSubTab] = useState<'investigacion' | 'medular'>('investigacion')
  const [lineasMedulares, setLineasMedulares] = useState<LineaMedularLocal[]>(getLineasMedularesLocal())
  const [nombreNuevaLineaMedular, setNombreNuevaLineaMedular] = useState('')
  const [editandoLineaMedular, setEditandoLineaMedular] = useState<{ id: number; nombre: string } | null>(null)

  const [editando, setEditando] = useState<ItemEditando | null>(null)
  const [eliminarPendiente, setEliminarPendiente] = useState<ItemAEliminar | null>(null)
  const [accionEnCurso, setAccionEnCurso] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const cargarTodo = () => {
    setCargando(true)
    setError('')

    Promise.all([
      Promise.all(DEFINICIONES.map(({ tipo }) => cargarItems(tipo).then((lista) => [tipo, lista] as const))),
      opcionesApi.obtenerLimitesTexto(id_convocatoria),
      catalogosApi.listarTiposPrograma(),
    ])
      .then(([listas, limitesGuardados, tiposProgramaRes]) => {
        const itemsCargados = {} as Record<TipoOpcionConvocatoria, ItemCatalogo[]>
        for (const [tipo, lista] of listas) itemsCargados[tipo] = lista
        setItems(itemsCargados)
        setTiposPrograma(tiposProgramaRes)

        const limitesPorClave = new Map(limitesGuardados.map((l) => [l.clave, l.max_caracteres]))
        const nuevosLimites: Record<string, number> = {}
        for (const { clave } of ETIQUETAS_LIMITES) {
          nuevosLimites[clave] = limitesPorClave.get(clave) ?? getLimites().find((l) => l.clave === clave)!.maxCaracteres
        }
        nuevosLimites[CLAVE_ANTECEDENTES_CANTIDAD] =
          limitesPorClave.get(CLAVE_ANTECEDENTES_CANTIDAD) ?? getLimiteAntecedentes()
        setLimites(nuevosLimites)
        setLimitesGuardados(nuevosLimites)
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

  // Arrastrar y soltar para reordenar las opciones de la pestaña activa (igual
  // que "Resultados esperados"): una sola instancia del hook, re-apuntada a la
  // lista que corresponda según la pestaña/subpestaña visible en cada momento.
  const listaActivaParaArrastre: ItemArrastrable[] =
    tabActivo === 'linea' && lineaSubTab === 'medular'
      ? lineasMedulares.filter((l) => l.categoria === 'medular')
      : tabActivo === 'programa'
        ? (items.programa ?? []).filter((p) => p.tipoProgramaNombre === progSubTab)
        : tabActivo === 'limites' || tabActivo === 'categoria_producto'
          ? []
          : items[tabActivo] ?? []

  const setListaActivaParaArrastre = (nuevaLista: ItemArrastrable[]) => {
    if (tabActivo === 'linea' && lineaSubTab === 'medular') {
      const noMedulares = lineasMedulares.filter((l) => l.categoria !== 'medular')
      setLineasMedulares([...noMedulares, ...(nuevaLista as LineaMedularLocal[])])
      return
    }
    if (tabActivo === 'programa') {
      const otroSubTab = (items.programa ?? []).filter((p) => p.tipoProgramaNombre !== progSubTab)
      setItems((actual) => ({ ...actual, programa: [...otroSubTab, ...(nuevaLista as ItemCatalogo[])] }))
      return
    }
    if (tabActivo === 'limites' || tabActivo === 'categoria_producto') return
    setItems((actual) => ({ ...actual, [tabActivo]: nuevaLista as ItemCatalogo[] }))
  }

  const guardarOrdenActivo = (ids: number[]) => {
    if (tabActivo === 'linea' && lineaSubTab === 'medular') {
      reordenarLineasMedularesLocal('medular', ids)
      return
    }
    switch (tabActivo) {
      case 'periodo':
        catalogosApi.reordenarPeriodos(ids).catch(() => refrescarTipo('periodo'))
        break
      case 'facultad':
        catalogosApi.reordenarFacultades(ids).catch(() => refrescarTipo('facultad'))
        break
      case 'programa': {
        const id_tipo_programa = tiposPrograma.find((t) => t.nombre === progSubTab)?.id_tipo_programa
        if (id_tipo_programa) catalogosApi.reordenarProgramas(id_tipo_programa, ids).catch(() => refrescarTipo('programa'))
        break
      }
      case 'grupo':
        gruposApi.reordenarGrupos(ids).catch(() => refrescarTipo('grupo'))
        break
      case 'linea':
        catalogosApi.reordenarLineasInvestigacion(ids).catch(() => refrescarTipo('linea'))
        break
      case 'ods':
        catalogosApi.reordenarOds(ids).catch(() => refrescarTipo('ods'))
        break
      case 'area':
        catalogosApi.reordenarAreasConocimiento(ids).catch(() => refrescarTipo('area'))
        break
      case 'modalidad':
        catalogosApi.reordenarModalidadesProyecto(ids).catch(() => refrescarTipo('modalidad'))
        break
      case 'tipo_proyecto':
        catalogosApi.reordenarTiposProyecto(ids).catch(() => refrescarTipo('tipo_proyecto'))
        break
    }
  }

  const arrastreActivo = useArrastrarLista(
    'cop',
    listaActivaParaArrastre,
    (i) => i.id,
    (i) => i.nombre,
    setListaActivaParaArrastre,
    guardarOrdenActivo
  )

  const handleAgregarItem = (tipo: TipoOpcionConvocatoria) => {
    const nombre = (nombreNuevoItem[tipo] ?? '').trim()
    if (!nombre) return
    setErrorAccion('')
    setAccionEnCurso(true)

    const datosPrograma =
      tipo === 'programa' && facultadNuevoPrograma
        ? {
          id_facultad: facultadNuevoPrograma,
          id_tipo_programa: tiposPrograma.find((t) => t.nombre === progSubTab)?.id_tipo_programa ?? 0,
        }
        : undefined

    const descripcion = tipo === 'area' || tipo === 'ods' ? (descripcionNuevoItem[tipo] ?? '').trim() || undefined : undefined

    crearItemCatalogo(tipo, nombre, datosPrograma, descripcion)
      .then(() => {
        setNombreNuevoItem((actual) => ({ ...actual, [tipo]: '' }))
        setDescripcionNuevoItem((actual) => ({ ...actual, [tipo]: '' }))
        return refrescarTipo(tipo)
      })
      .catch((err) => setErrorAccion(err instanceof ApiError ? err.message : err.message || 'No se pudo crear el elemento.'))
      .finally(() => setAccionEnCurso(false))
  }

  const abrirEditar = (tipo: TipoOpcionConvocatoria, item: ItemCatalogo) => {
    setErrorAccion('')
    setEditando({ tipo, id: item.id, nombre: item.nombre, descripcion: item.descripcion ?? '' })
  }

  const guardarEdicion = () => {
    if (!editando) return
    const nombre = editando.nombre.trim()
    if (!nombre) return
    setAccionEnCurso(true)
    setErrorAccion('')

    renombrarItemCatalogo(editando.tipo, editando.id, nombre, editando.descripcion?.trim() || undefined)
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
      .then(() => refrescarTipo(tipo))
      .catch((err) => setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo eliminar el elemento.'))
      .finally(() => {
        setAccionEnCurso(false)
        setEliminarPendiente(null)
      })
  }

  const refrescarLineasMedulares = () => setLineasMedulares([...getLineasMedularesLocal()])

  const handleAgregarLineaMedular = () => {
    const nombre = nombreNuevaLineaMedular.trim()
    if (!nombre) return
    addLineaMedularLocal(nombre, 'medular')
    setNombreNuevaLineaMedular('')
    refrescarLineasMedulares()
  }

  const guardarEdicionLineaMedular = () => {
    if (!editandoLineaMedular) return
    const nombre = editandoLineaMedular.nombre.trim()
    if (!nombre) return
    editarLineaMedularLocal(editandoLineaMedular.id, nombre)
    setEditandoLineaMedular(null)
    refrescarLineasMedulares()
  }

  const handleGuardar = () => {
    setGuardando(true)
    setError('')

    const limitesLista = Object.entries(limites).map(([clave, max_caracteres]) => ({ clave, max_caracteres }))

    opcionesApi
      .reemplazarLimitesTexto(id_convocatoria, limitesLista)
      .then(() => {
        setLimitesGuardados(limites)
        onFinalizar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración.'))
      .finally(() => setGuardando(false))
  }

  const hayLimitesSinGuardar = JSON.stringify(limites) !== JSON.stringify(limitesGuardados)

  const handleVolverClick = () => {
    if (hayLimitesSinGuardar) {
      setMostrarConfirmarSalida(true)
    } else {
      onCancelar()
    }
  }

  if (cargando) {
    return <p className="cop-cargando">Cargando configuración de la convocatoria...</p>
  }

  const facultadesActivas = (items.facultad ?? []).filter((f) => f.activo)

  return (
    <div className="cop-wrapper">
      <div className="cop-panel">
        <div className="cop-header-row">
          <button type="button" className="cop-volver-btn-top" onClick={handleVolverClick} disabled={guardando}>
            <ArrowLeft size={16} />
            Volver
          </button>
          <h3 className="cop-titulo">Configurar opciones para esta convocatoria</h3>
        </div>
        <p className="cop-subtitulo">
          Estos catálogos son globales: todo elemento activo queda disponible para el investigador en cualquier
          convocatoria. Aquí puedes añadir, editar, activar/desactivar o eliminar elementos del catálogo.
        </p>

        <div className="cop-tabs">
          {DEFINICIONES.map(({ tipo, etiqueta }) => (
            <button
              key={tipo}
              type="button"
              className={`cop-tab ${tabActivo === tipo ? 'cop-tab-active' : ''}`}
              onClick={() => setTabActivo(tipo)}
            >
              {etiqueta}
            </button>
          ))}
          <button
            type="button"
            className={`cop-tab ${tabActivo === 'limites' ? 'cop-tab-active' : ''}`}
            onClick={() => setTabActivo('limites')}
          >
            Límites de texto
          </button>
        </div>

        {tabActivo === 'limites' ? (
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
        ) : tabActivo === 'categoria_producto' ? (
          <div className="cop-seccion-body">
            <ResultadosEsperadosTab />
          </div>
        ) : (
          (() => {
            const tipo = tabActivo
            const etiqueta = DEFINICIONES.find((d) => d.tipo === tipo)!.etiqueta
            const tieneDescripcion = tipo === 'area' || tipo === 'ods'
            const lista =
              tipo === 'programa'
                ? (items.programa ?? []).filter((p) => p.tipoProgramaNombre === progSubTab)
                : items[tipo] ?? []

            return (
              <div className="cop-seccion-body">
                {tipo === 'programa' && (
                  <div className="cop-subtabs">
                    <button
                      type="button"
                      className={`cop-subtab ${progSubTab === 'pregrado' ? 'cop-subtab-active' : ''}`}
                      onClick={() => setProgSubTab('pregrado')}
                    >
                      Pregrado
                    </button>
                    <button
                      type="button"
                      className={`cop-subtab ${progSubTab === 'posgrado' ? 'cop-subtab-active' : ''}`}
                      onClick={() => setProgSubTab('posgrado')}
                    >
                      Posgrado
                    </button>
                  </div>
                )}

                {tipo === 'linea' && (
                  <div className="cop-subtabs">
                    <button
                      type="button"
                      className={`cop-subtab ${lineaSubTab === 'investigacion' ? 'cop-subtab-active' : ''}`}
                      onClick={() => setLineaSubTab('investigacion')}
                    >
                      Línea de investigación
                    </button>
                    <button
                      type="button"
                      className={`cop-subtab ${lineaSubTab === 'medular' ? 'cop-subtab-active' : ''}`}
                      onClick={() => setLineaSubTab('medular')}
                    >
                      Línea medular
                    </button>
                  </div>
                )}

                {tipo === 'linea' && lineaSubTab === 'medular' ? (
                  <>
                    <div className="cop-items-grid">
                      {lineasMedulares
                        .filter((l) => l.categoria === 'medular')
                        .map((l) => (
                          <div
                            className={`cop-item-card ${arrastreActivo.arrastre?.id === l.id ? 'cop-fila-arrastrando' : ''}`}
                            key={l.id}
                            data-drag-row={`cop-${l.id}`}
                          >
                            <span
                              className="cop-grip"
                              onPointerDown={(e) => arrastreActivo.iniciar(e, l)}
                              aria-label={`Arrastrar para reordenar ${l.nombre}`}
                              title="Arrastrar para reordenar"
                            >
                              <GripVertical size={15} />
                            </span>
                            {editandoLineaMedular?.id === l.id ? (
                              <>
                                <input
                                  type="text"
                                  className="cop-item-input-editar"
                                  value={editandoLineaMedular.nombre}
                                  onChange={(e) => setEditandoLineaMedular({ ...editandoLineaMedular, nombre: e.target.value })}
                                />
                                <div className="cop-item-card-acciones">
                                  <button type="button" onClick={guardarEdicionLineaMedular} aria-label="Guardar">
                                    <Check size={16} />
                                  </button>
                                  <button type="button" onClick={() => setEditandoLineaMedular(null)} aria-label="Cancelar">
                                    <XIcon size={16} />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className={`cop-item-nombre${l.activa ? '' : ' cop-item-inactivo'}`}>{l.nombre}</span>
                                <div className="cop-item-card-acciones">
                                  <button
                                    type="button"
                                    onClick={() => setEditandoLineaMedular({ id: l.id, nombre: l.nombre })}
                                    aria-label={`Editar ${l.nombre}`}
                                  >
                                    <SquarePen size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="cop-item-eliminar-btn"
                                    onClick={() => {
                                      eliminarLineaMedularLocal(l.id)
                                      refrescarLineasMedulares()
                                    }}
                                    aria-label={`Eliminar ${l.nombre}`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  <label className="cop-item-switch">
                                    <input
                                      type="checkbox"
                                      checked={l.activa}
                                      onChange={() => {
                                        toggleLineaMedularLocal(l.id)
                                        refrescarLineasMedulares()
                                      }}
                                    />
                                    <span />
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      {lineasMedulares.filter((l) => l.categoria === 'medular').length === 0 && (
                        <p className="cop-items-vacio">Este catálogo todavía no tiene elementos.</p>
                      )}
                    </div>

                    <div className="cop-item-nuevo">
                      <input
                        type="text"
                        placeholder="Nombre de la nueva línea medular..."
                        value={nombreNuevaLineaMedular}
                        onChange={(e) => setNombreNuevaLineaMedular(e.target.value)}
                      />
                      <button type="button" className="cop-item-agregar-btn" onClick={handleAgregarLineaMedular}>
                        <Plus size={14} />
                        Añadir
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cop-items-grid">
                      {lista.map((item) => (
                        <div
                          className={`cop-item-card ${arrastreActivo.arrastre?.id === item.id ? 'cop-fila-arrastrando' : ''}`}
                          key={item.id}
                          data-drag-row={`cop-${item.id}`}
                        >
                          <span
                            className="cop-grip"
                            onPointerDown={(e) => {
                              if (!accionEnCurso) arrastreActivo.iniciar(e, item)
                            }}
                            aria-label={`Arrastrar para reordenar ${item.nombre}`}
                            title="Arrastrar para reordenar"
                          >
                            <GripVertical size={15} />
                          </span>
                          {editando?.tipo === tipo && editando.id === item.id ? (
                            <>
                              <div className="cop-item-editar-campos">
                                <input
                                  type="text"
                                  className="cop-item-input-editar"
                                  value={editando.nombre}
                                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                                />
                                {tipo === 'area' && (
                                  <textarea
                                    className="cop-item-textarea-editar"
                                    placeholder="Descripción (opcional)"
                                    value={editando.descripcion ?? ''}
                                    onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                                  />
                                )}
                              </div>
                              <div className="cop-item-card-acciones">
                                <button type="button" onClick={guardarEdicion} disabled={accionEnCurso} aria-label="Guardar">
                                  <Check size={16} />
                                </button>
                                <button type="button" onClick={() => setEditando(null)} disabled={accionEnCurso} aria-label="Cancelar">
                                  <XIcon size={16} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="cop-item-textos">
                                <span className={`cop-item-nombre${item.activo ? '' : ' cop-item-inactivo'}`}>{item.nombre}</span>
                                {tieneDescripcion && item.descripcion && (
                                  <span className="cop-item-descripcion">{item.descripcion}</span>
                                )}
                              </div>
                              <div className="cop-item-card-acciones">
                                <button
                                  type="button"
                                  onClick={() => abrirEditar(tipo, item)}
                                  disabled={accionEnCurso}
                                  aria-label={`Editar ${item.nombre}`}
                                >
                                  <SquarePen size={16} />
                                </button>
                                {puedeEliminar(tipo) && (
                                  <button
                                    type="button"
                                    className="cop-item-eliminar-btn"
                                    onClick={() => setEliminarPendiente({ tipo, id: item.id, nombre: item.nombre })}
                                    disabled={accionEnCurso}
                                    aria-label={`Eliminar ${item.nombre}`}
                                  >
                                    <Trash2 size={16} />
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
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {lista.length === 0 && <p className="cop-items-vacio">Este catálogo todavía no tiene elementos.</p>}
                    </div>

                    <div className="cop-item-nuevo">
                      {tipo === 'programa' && (
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
                      )}
                      <input
                        type="text"
                        placeholder={`Nombre del nuevo ${etiqueta.toLowerCase()}...`}
                        value={nombreNuevoItem[tipo] ?? ''}
                        onChange={(e) => setNombreNuevoItem((actual) => ({ ...actual, [tipo]: e.target.value }))}
                      />
                      {tieneDescripcion && (
                        <input
                          type="text"
                          placeholder="Descripción (opcional)"
                          value={descripcionNuevoItem[tipo] ?? ''}
                          onChange={(e) => setDescripcionNuevoItem((actual) => ({ ...actual, [tipo]: e.target.value }))}
                        />
                      )}
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
                  </>
                )}

                <CuadroFlotante arrastre={arrastreActivo.arrastre} className="cop-drag-clone" />

                {errorAccion && <p className="cop-error">{errorAccion}</p>}
              </div>
            )
          })()
        )}

        {error && <p className="cop-error">{error}</p>}

        <div className="cop-acciones">
          <button type="button" className="cop-guardar-btn" onClick={handleGuardar} disabled={guardando}>
            <Save size={16} />
            {guardando ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>

      {eliminarPendiente && (
        <ConfirmModal
          mensaje={`¿Seguro que desea eliminar "${eliminarPendiente.nombre}" del catálogo? Esto lo afecta para todas las convocatorias.`}
          botonSecundario={{ label: 'No', onClick: () => setEliminarPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
          onClose={() => setEliminarPendiente(null)}
        />
      )}

      {mostrarConfirmarSalida && (
        <ConfirmModal
          mensaje="Tienes cambios sin guardar en los límites de texto. ¿Estás seguro que deseas salir?"
          botonSecundario={{ label: 'No', onClick: () => setMostrarConfirmarSalida(false), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: onCancelar, variante: 'rojo' }}
          onClose={() => setMostrarConfirmarSalida(false)}
        />
      )}
    </div>
  )
}

export default ConfigurarOpcionesConvocatoria
