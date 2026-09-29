import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import * as liderApi from '../api/lider'
import * as productosApi from '../../proyectos/api/productos'
import type { CategoriaProductoItem } from '../../proyectos/api/productos'
import { ApiError } from '../../../shared/api/client'
import './SeguimientoProyectos.css'

function fechaParaInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

const NUM_COLUMNAS_FIJAS = 21

function SeguimientoProyectos() {
  const [filas, setFilas] = useState<liderApi.ProyectoSeguimiento[]>([])
  const [categoriasProducto, setCategoriasProducto] = useState<CategoriaProductoItem[]>([])
  const [tiposArticulacion, setTiposArticulacion] = useState<liderApi.TipoArticulacionItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [guardandoCelda, setGuardandoCelda] = useState<string | null>(null)

  const cargar = () => {
    setCargando(true)
    setError('')
    Promise.all([
      liderApi.listarProyectosSeguimiento(),
      productosApi.listarCategoriasProducto(true),
      liderApi.listarTiposArticulacion(),
    ])
      .then(([proyectos, categorias, tipos]) => {
        setFilas(proyectos)
        setTiposArticulacion(tipos)
        // Solo categorías con al menos un tipo de producto — una vacía no aporta ninguna columna.
        setCategoriasProducto(categorias.filter((c) => c.subcategorias.some((s) => s.tipos.length > 0)))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el seguimiento de proyectos.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
  }, [])

  /** Columna por tipo de producto, en el mismo orden en que se recorren los <th>: categoría > subcategoría > tipo. */
  const columnasProducto = useMemo(
    () =>
      categoriasProducto.flatMap((cat) =>
        cat.subcategorias.flatMap((sub) =>
          sub.tipos.map((tipo) => ({
            id_tipo_producto: tipo.id_tipo_producto,
            nombre: tipo.nombre,
            subcategoria: sub.nombre,
            categoria: cat.nombre,
          }))
        )
      ),
    [categoriasProducto]
  )

  const actualizarFilaLocal = (id_proyecto: number, cambios: Partial<liderApi.ProyectoSeguimiento>) => {
    setFilas((actual) => actual.map((f) => (f.id_proyecto === id_proyecto ? { ...f, ...cambios } : f)))
  }

  const guardarCampo = async (id_proyecto: number, clave: string, datos: liderApi.DatosSeguimientoProyecto) => {
    setGuardandoCelda(clave)
    try {
      await liderApi.actualizarSeguimientoProyecto(id_proyecto, datos)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio.')
      cargar()
    } finally {
      setGuardandoCelda(null)
    }
  }

  const guardarObtenido = async (id_proyecto: number, id_tipo_producto: number, valor: string) => {
    const cantidad = valor === '' ? 0 : Math.max(0, Number(valor) || 0)
    const clave = `obtenido-${id_proyecto}-${id_tipo_producto}`
    setGuardandoCelda(clave)

    const fila = filas.find((f) => f.id_proyecto === id_proyecto)
    const productosActualizados = fila
      ? fila.productos.some((p) => p.id_tipo_producto === id_tipo_producto)
        ? fila.productos.map((p) => (p.id_tipo_producto === id_tipo_producto ? { ...p, obtenido: cantidad } : p))
        : [
            ...fila.productos,
            { id_tipo_producto, obtenido: cantidad, proyectado: 0, nombre: '', subcategoria: '', categoria: '' },
          ]
      : []
    actualizarFilaLocal(id_proyecto, { productos: productosActualizados })

    try {
      await liderApi.registrarProductoObtenido(id_proyecto, id_tipo_producto, cantidad)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el resultado obtenido.')
      cargar()
    } finally {
      setGuardandoCelda(null)
    }
  }

  const filasFiltradas = useMemo(
    () =>
      filas.filter((f) =>
        [f.titulo, f.investigador_principal ?? '', ...f.grupos].some((campo) =>
          campo.toLowerCase().includes(busqueda.toLowerCase())
        )
      ),
    [filas, busqueda]
  )

  if (cargando) {
    return (
      <div className="lider-page">
        <p className="lider-vacio">Cargando seguimiento de proyectos...</p>
      </div>
    )
  }

  return (
    <div className="lider-page">
      <div className="lider-header-card">
        <h2>Seguimiento de resultados de proyectos</h2>
        <p>Consolidado de proyectos con lo proyectado y lo obtenido, para reportar ante la Vicerrectoría de Investigación y Extensión.</p>
      </div>

      <div className="lider-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Busca por título, investigador principal o grupo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <p className="lider-error">{error}</p>}

      <div className="lider-table-scroll">
        <table className="lider-table">
          <thead>
            {/* Fila 1: columnas fijas (ocupan las 3 filas de encabezado) + una celda por categoría de producto. */}
            <tr>
              <th rowSpan={3}><span className="lider-th-clip">No.</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Título del proyecto</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Objetivo</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Tipo de articulación</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Investigador principal</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Co-investigador(es)</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Grupo de investigación</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Programa académico</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Línea de investigación</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Modalidad del proyecto</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Duración (periodos)</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Duración (meses)</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Fecha inicio</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Fecha fin</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Total proyecto</span></th>
              <th rowSpan={3}><span className="lider-th-clip">No. estudiantes</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Egresados</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Centro de costos</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Estado</span></th>
              {categoriasProducto.map((cat) => {
                const numTipos = cat.subcategorias.reduce((sum, s) => sum + s.tipos.length, 0)
                return (
                  <th key={cat.id_categoria} colSpan={numTipos * 2} className="lider-th-categoria">
                    <span className="lider-th-clip lider-th-clip-categoria">{cat.nombre}</span>
                  </th>
                )
              })}
              <th rowSpan={3}><span className="lider-th-clip">Evidencias</span></th>
              <th rowSpan={3}><span className="lider-th-clip">Observaciones</span></th>
            </tr>
            {/* Fila 2: un tipo de producto por cada par Proyectado/Obtenido. */}
            <tr>
              {columnasProducto.flatMap((c) => (
                <th key={c.id_tipo_producto} colSpan={2} className="lider-th-tipo" title={`${c.categoria} · ${c.subcategoria} · ${c.nombre}`}>
                  <span className="lider-th-clip">{c.nombre}</span>
                </th>
              ))}
            </tr>
            {/* Fila 3: Proyectado / Obtenido de cada tipo. */}
            <tr>
              {columnasProducto.flatMap((c) => [
                <th key={`${c.id_tipo_producto}-p`} className="lider-th-sub">Proy.</th>,
                <th key={`${c.id_tipo_producto}-o`} className="lider-th-sub">Obt.</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map((f, i) => (
              <tr key={f.id_proyecto}>
                <td className="lider-td-centro">{i + 1}</td>
                <td className="lider-td-titulo">{f.titulo}</td>
                <td className="lider-td-ancho">{f.objetivo_general ?? '—'}</td>
                <td>
                  <select
                    value={f.id_tipo_articulacion ?? ''}
                    disabled={guardandoCelda === `articulacion-${f.id_proyecto}`}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null
                      actualizarFilaLocal(f.id_proyecto, {
                        id_tipo_articulacion: id,
                        tipo_articulacion: tiposArticulacion.find((t) => t.id_tipo_articulacion === id)?.nombre ?? null,
                      })
                      guardarCampo(f.id_proyecto, `articulacion-${f.id_proyecto}`, { id_tipo_articulacion: id })
                    }}
                  >
                    <option value="">Sin definir</option>
                    {tiposArticulacion.map((t) => (
                      <option key={t.id_tipo_articulacion} value={t.id_tipo_articulacion}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{f.investigador_principal ?? '—'}</td>
                <td className="lider-td-ancho">{f.co_investigadores.join(', ') || '—'}</td>
                <td>{f.grupos.join(' / ') || '—'}</td>
                <td>{f.programas_academicos.join(', ') || '—'}</td>
                <td>{f.lineas_investigacion.join(', ') || '—'}</td>
                <td>{f.modalidad}</td>
                <td className="lider-td-centro">{f.duracion_periodos ?? '—'}</td>
                <td className="lider-td-centro">
                  <input
                    type="number"
                    min={0}
                    className="lider-input-numero"
                    defaultValue={f.duracion_meses ?? ''}
                    onBlur={(e) => {
                      const valor = e.target.value ? Number(e.target.value) : null
                      guardarCampo(f.id_proyecto, `meses-${f.id_proyecto}`, { duracion_meses: valor })
                    }}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    className="lider-input-fecha"
                    defaultValue={fechaParaInput(f.fecha_inicio_real)}
                    onBlur={(e) => guardarCampo(f.id_proyecto, `finicio-${f.id_proyecto}`, { fecha_inicio_real: e.target.value || null })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    className="lider-input-fecha"
                    defaultValue={fechaParaInput(f.fecha_fin_real)}
                    onBlur={(e) => guardarCampo(f.id_proyecto, `ffin-${f.id_proyecto}`, { fecha_fin_real: e.target.value || null })}
                  />
                </td>
                <td className="lider-td-centro">
                  {f.valor_total ? Number(f.valor_total).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '—'}
                </td>
                <td className="lider-td-centro">{f.num_estudiantes}</td>
                <td className="lider-td-centro">{f.num_egresados}</td>
                <td>
                  <input
                    type="text"
                    className="lider-input-texto"
                    defaultValue={f.centro_costos ?? ''}
                    onBlur={(e) => guardarCampo(f.id_proyecto, `costos-${f.id_proyecto}`, { centro_costos: e.target.value || null })}
                  />
                </td>
                <td>{f.estado_actual}</td>
                {columnasProducto.flatMap((c) => {
                  const producto = f.productos.find((p) => p.id_tipo_producto === c.id_tipo_producto)
                  return [
                    <td key={`${c.id_tipo_producto}-p`} className="lider-td-producto">
                      {producto?.proyectado || ''}
                    </td>,
                    <td key={`${c.id_tipo_producto}-o`} className="lider-td-producto">
                      <input
                        type="number"
                        min={0}
                        className="lider-input-numero"
                        defaultValue={producto?.obtenido ?? ''}
                        onBlur={(e) => guardarObtenido(f.id_proyecto, c.id_tipo_producto, e.target.value)}
                      />
                    </td>,
                  ]
                })}
                <td>
                  <input
                    type="text"
                    className="lider-input-texto"
                    defaultValue={f.evidencias_resultados ?? ''}
                    onBlur={(e) => guardarCampo(f.id_proyecto, `evid-${f.id_proyecto}`, { evidencias_resultados: e.target.value || null })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="lider-input-texto"
                    defaultValue={f.observaciones_resultados ?? ''}
                    onBlur={(e) => guardarCampo(f.id_proyecto, `obs-${f.id_proyecto}`, { observaciones_resultados: e.target.value || null })}
                  />
                </td>
              </tr>
            ))}

            {filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={NUM_COLUMNAS_FIJAS + columnasProducto.length * 2} className="lider-vacio">
                  No se encontraron proyectos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SeguimientoProyectos
