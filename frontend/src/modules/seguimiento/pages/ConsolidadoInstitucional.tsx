import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import DonutChart from '../../../shared/components/common/DonutChart'
import * as api from '../api/seguimiento'
import type { ProyectoSeguimiento } from '../api/tipos'
import { formatoPesos } from '../lib/formato'
import { duracionTotal, estadoSeguimiento, totalAsignado, totalesProductos } from '../lib/reglas'
import { Badge, Encabezado, Kpi } from '../components/UI'
import './Seguimiento.css'

const COLORES = { ejecucion: '#2f5fa8', finalizado: '#27ae60', cancelado: '#c0392b' }

interface FilaConsolidado {
  id: number
  titulo: string
  modalidad: string
  articulacion: string
  investigador: string
  grupo: string
  centro_costos: string
  duracion: number
  total: number
  estado: string
  articulos_proy: number
  articulos_obt: number
  libros_proy: number
  libros_obt: number
}

function aFila(p: ProyectoSeguimiento): FilaConsolidado {
  const articulos = p.productos.filter((x) => x.nombre.toLowerCase().includes('artículo'))
  return {
    id: p.id_proyecto,
    titulo: p.titulo,
    modalidad: p.modalidad,
    articulacion: p.articulacion,
    investigador: p.investigador_principal,
    grupo: p.grupo,
    centro_costos: p.centro_costos,
    duracion: duracionTotal(p),
    total: totalAsignado(p),
    estado: estadoSeguimiento(p),
    articulos_proy: articulos.reduce((t, x) => t + x.proyectado, 0),
    articulos_obt: articulos.reduce((t, x) => t + (x.obtenido ?? 0), 0),
    libros_proy: 0,
    libros_obt: p.cierre.libros,
  }
}

const COLUMNAS_CSV: [string, keyof FilaConsolidado][] = [
  ['Título', 'titulo'], ['Modalidad', 'modalidad'], ['Articulación', 'articulacion'], ['Investigador principal', 'investigador'],
  ['Grupo', 'grupo'], ['Centro de costos', 'centro_costos'], ['Duración (meses)', 'duracion'], ['Total proyecto', 'total'],
  ['Estado', 'estado'], ['Artículos proyectados', 'articulos_proy'], ['Artículos obtenidos', 'articulos_obt'],
  ['Libros proyectados', 'libros_proy'], ['Libros obtenidos', 'libros_obt'],
]

function exportarCsv(filas: FilaConsolidado[]) {
  const celda = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
  // BOM + punto y coma: Excel en español lo abre con tildes y columnas correctas.
  const csv = '﻿' + [COLUMNAS_CSV.map(([t]) => celda(t)).join(';'), ...filas.map((f) => COLUMNAS_CSV.map(([, k]) => celda(f[k])).join(';'))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = 'consolidado_institucional.csv'
  enlace.click()
  URL.revokeObjectURL(url)
}

/** M-08: reporte consolidado institucional de proyectos en seguimiento. */
function ConsolidadoInstitucional() {
  const [proyectos, setProyectos] = useState<ProyectoSeguimiento[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroArticulacion, setFiltroArticulacion] = useState('')

  useEffect(() => {
    api.listarProyectosSeguimiento().then(setProyectos)
  }, [])

  const todas = useMemo(() => proyectos.map(aFila), [proyectos])
  const filas = todas.filter((f) => (!filtroEstado || f.estado === filtroEstado) && (!filtroArticulacion || f.articulacion === filtroArticulacion))

  const finalizados = todas.filter((f) => f.estado === 'Finalizado').length
  const cancelados = todas.filter((f) => f.estado === 'Cancelado').length
  const enEjecucion = todas.length - finalizados - cancelados
  const cumplimiento = proyectos.length
    ? Math.round((proyectos.reduce((t, p) => t + totalesProductos(p).porcentaje, 0) / proyectos.length) * 10) / 10
    : 0

  const estados = [...new Set(todas.map((f) => f.estado))]
  const articulaciones = [...new Set(todas.map((f) => f.articulacion))]

  return (
    <div className="seg-page">
      <Encabezado titulo="Reporte consolidado institucional" miga="Seguimiento › Reportes">
        <p className="seg-ayuda">Estado, presupuesto y productos de todos los proyectos en etapa de seguimiento.</p>
      </Encabezado>

      <section className="seg-card">
        <div className="seg-kpis">
          <Kpi etiqueta="Proyectos" valor={todas.length} />
          <Kpi etiqueta="En ejecución" valor={enEjecucion} color={COLORES.ejecucion} />
          <Kpi etiqueta="Finalizados" valor={finalizados} color={COLORES.finalizado} />
          <Kpi etiqueta="Cancelados" valor={cancelados} color={COLORES.cancelado} />
          <Kpi etiqueta="Cumplimiento promedio" valor={`${cumplimiento} %`} />
        </div>

        <div className="seg-dona">
          <DonutChart
            data={[
              { label: 'En ejecución', value: enEjecucion, color: COLORES.ejecucion },
              { label: 'Finalizados', value: finalizados, color: COLORES.finalizado },
              { label: 'Cancelados', value: cancelados, color: COLORES.cancelado },
            ]}
          />
          <div className="seg-leyenda">
            <span><i style={{ background: COLORES.ejecucion }} /> En ejecución · {enEjecucion}</span>
            <span><i style={{ background: COLORES.finalizado }} /> Finalizados · {finalizados}</span>
            <span><i style={{ background: COLORES.cancelado }} /> Cancelados · {cancelados}</span>
          </div>
        </div>

        <div className="seg-filtros" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select aria-label="Filtrar por estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {estados.map((x) => <option key={x}>{x}</option>)}
            </select>
            <select aria-label="Filtrar por articulación" value={filtroArticulacion} onChange={(e) => setFiltroArticulacion(e.target.value)}>
              <option value="">Todas las articulaciones</option>
              {articulaciones.map((x) => <option key={x}>{x}</option>)}
            </select>
            {(filtroEstado || filtroArticulacion) && (
              <button type="button" className="seg-link" onClick={() => { setFiltroEstado(''); setFiltroArticulacion('') }}>Limpiar filtros</button>
            )}
          </div>
          <button type="button" className="seg-btn" disabled={filas.length === 0} onClick={() => exportarCsv(filas)}>
            <Download size={14} /> Exportar a Excel (CSV)
          </button>
        </div>

        <div className="seg-tabla-wrap">
          <table className="seg-tabla">
            <thead>
              <tr>
                <th rowSpan={2}>Título</th><th rowSpan={2}>Modalidad</th><th rowSpan={2}>Articulación</th><th rowSpan={2}>Inv. principal</th>
                <th rowSpan={2}>Grupo</th><th rowSpan={2}>Centro de costos</th><th rowSpan={2}>Duración</th><th rowSpan={2}>Total proyecto</th>
                <th rowSpan={2}>Estado</th><th colSpan={2} className="c">Artículos</th><th colSpan={2} className="c">Libros</th>
              </tr>
              <tr><th className="c">Proy.</th><th className="c">Obt.</th><th className="c">Proy.</th><th className="c">Obt.</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>{f.titulo}</td><td>{f.modalidad}</td><td>{f.articulacion}</td><td>{f.investigador}</td>
                  <td>{f.grupo}</td><td>{f.centro_costos}</td><td>{f.duracion} meses</td><td>{formatoPesos(f.total)}</td>
                  <td><Badge estado={f.estado} /></td>
                  <td className="c">{f.articulos_proy}</td><td className="c">{f.articulos_obt}</td>
                  <td className="c">{f.libros_proy}</td><td className="c">{f.libros_obt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="seg-ayuda" style={{ marginTop: 10 }}>Mostrando {filas.length} de {todas.length} proyectos.</p>
      </section>
    </div>
  )
}

export default ConsolidadoInstitucional
