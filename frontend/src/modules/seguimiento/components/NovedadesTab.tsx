import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import * as api from '../api/seguimiento'
import type { TipoNovedad } from '../api/tipos'
import { formatoFecha } from '../lib/formato'
import { detalleNovedad, fechaFin } from '../lib/reglas'
import { Aviso, Badge, CampoLectura } from './UI'
import type { PropsPestana } from './props'

const novedadVacia = (): api.DatosNovedad => ({
  id_tipo: 0,
  justificacion: '',
  soporte: '',
  meses_prorroga: 6,
  participante_saliente: '',
  participante_entrante: '',
  acto_administrativo: '',
})

function mensajeTipo(t: TipoNovedad | undefined): string {
  if (!t) return ''
  if (t.nombre === 'Prórroga') return 'Al aprobarse, se recalculan la fecha de finalización y la duración, y se reprograman los periodos de informe pendientes.'
  if (t.nombre === 'Cancelación') return 'Al aprobarse, el proyecto quedará bloqueado para toda edición posterior.'
  if (t.afecta_participantes) return 'El participante saliente conserva su histórico de vinculación y los productos permanecen asociados al proyecto.'
  return 'La novedad quedará pendiente de decisión por parte de la Vicerrectoría.'
}

/** M-05 (Investigador): registro de novedades y su historial. */
function NovedadesTab({ proyecto, roles, ejecutar, ocupado, bloqueado }: PropsPestana) {
  const [tipos, setTipos] = useState<TipoNovedad[]>([])
  const [formAbierto, setFormAbierto] = useState(false)
  const [datos, setDatos] = useState<api.DatosNovedad>(novedadVacia)
  const puedeRegistrar = roles.includes('usuario') && !bloqueado

  useEffect(() => {
    api.listarTiposNovedad().then((lista) => setTipos(lista.filter((t) => t.activo)))
  }, [])

  const tipo = tipos.find((t) => t.id === datos.id_tipo)
  const cancelacion = tipo?.nombre === 'Cancelación'
  const pideMeses = !!tipo?.afecta_fechas && !cancelacion
  const pideParticipantes = !!tipo?.afecta_participantes && !cancelacion
  const activos = proyecto.participantes.filter((x) => !x.endsWith('(retirado)'))
  const valido =
    !!tipo &&
    !!datos.justificacion.trim() &&
    !!datos.soporte &&
    (!pideMeses || datos.meses_prorroga >= 1) &&
    (!pideParticipantes || !!datos.participante_saliente) &&
    (!cancelacion || !!datos.acto_administrativo.trim())

  const registrar = async () => {
    const ok = await ejecutar(() => api.registrarNovedad(proyecto.id_proyecto, datos), 'Novedad registrada. Queda pendiente de decisión de la Vicerrectoría.')
    if (ok) setFormAbierto(false)
  }

  return (
    <section className="seg-card">
      <h3>Novedades del proyecto</h3>
      {proyecto.novedades.length === 0 ? (
        <p className="seg-vacio">No hay novedades registradas.</p>
      ) : (
        <div className="seg-tabla-wrap">
          <table className="seg-tabla">
            <thead>
              <tr><th>Tipo</th><th>Fecha</th><th>Detalle</th><th>Justificación</th><th>Estado</th><th>Observación de la VIE</th></tr>
            </thead>
            <tbody>
              {proyecto.novedades.map((n) => (
                <tr key={n.id}>
                  <td><b>{n.tipo}</b></td>
                  <td>{formatoFecha(n.fecha)}</td>
                  <td>{detalleNovedad(n)}</td>
                  <td>{n.justificacion}</td>
                  <td><Badge estado={n.estado} /></td>
                  <td>{n.observacion || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeRegistrar && !formAbierto && (
        <div className="seg-acciones seg-acciones-izq">
          <button type="button" className="seg-btn" onClick={() => { setDatos({ ...novedadVacia(), id_tipo: tipos[0]?.id ?? 0 }); setFormAbierto(true) }}>
            <Plus size={14} /> Registrar novedad
          </button>
        </div>
      )}

      {puedeRegistrar && formAbierto && (
        <>
          <h3>Registrar novedad</h3>
          <div className="seg-grid">
            <label className="seg-campo">
              Tipo de novedad *
              <select value={datos.id_tipo} onChange={(e) => setDatos({ ...datos, id_tipo: Number(e.target.value) })}>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              {tipo?.descripcion && <span className="seg-ayuda">{tipo.descripcion}</span>}
            </label>
            {tipo?.afecta_fechas && <CampoLectura etiqueta="Fecha de finalización actual" valor={formatoFecha(fechaFin(proyecto))} />}
            {pideMeses && (
              <>
                <label className="seg-campo">
                  Meses de ampliación *
                  <input type="number" min={1} value={datos.meses_prorroga || ''} onChange={(e) => setDatos({ ...datos, meses_prorroga: Number(e.target.value) })} />
                </label>
                <CampoLectura etiqueta="Nueva fecha de finalización" valor={formatoFecha(fechaFin(proyecto, datos.meses_prorroga || 0))} />
              </>
            )}
            {pideParticipantes && (
              <>
                <label className="seg-campo">
                  Participante saliente *
                  <select value={datos.participante_saliente} onChange={(e) => setDatos({ ...datos, participante_saliente: e.target.value })}>
                    <option value="">Seleccione</option>
                    {activos.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="seg-campo">
                  Participante entrante
                  <input placeholder="Rol · Nombre (opcional)" value={datos.participante_entrante} onChange={(e) => setDatos({ ...datos, participante_entrante: e.target.value })} />
                </label>
              </>
            )}
            {cancelacion && (
              <label className="seg-campo">
                Acto administrativo *
                <input placeholder="Resolución No." value={datos.acto_administrativo} onChange={(e) => setDatos({ ...datos, acto_administrativo: e.target.value })} />
              </label>
            )}
            <label className="seg-campo seg-campo-ancho">
              Justificación *
              <textarea maxLength={1000} value={datos.justificacion} onChange={(e) => setDatos({ ...datos, justificacion: e.target.value })} />
            </label>
            <label className="seg-campo seg-campo-ancho">
              Soporte *
              <input type="file" onChange={(e) => setDatos({ ...datos, soporte: e.target.files?.[0]?.name ?? '' })} />
              {datos.soporte && <span className="seg-ayuda">Seleccionado: {datos.soporte}</span>}
            </label>
          </div>
          {tipo && <Aviso tipo="info">{mensajeTipo(tipo)}</Aviso>}
          <div className="seg-acciones">
            <button type="button" className="seg-btn seg-btn-borde" onClick={() => setFormAbierto(false)}>Cancelar</button>
            <button type="button" className="seg-btn" disabled={ocupado || !valido} onClick={registrar}>Registrar novedad</button>
          </div>
        </>
      )}
    </section>
  )
}

export default NovedadesTab
