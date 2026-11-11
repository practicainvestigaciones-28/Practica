import { useEffect, useState } from 'react'
import { ArrowLeft, Lock, LockOpen, Save } from 'lucide-react'
import { ApiError } from '../../../shared/api/client'
import * as ventanasApi from '../api/convocatoriaVentanas'
import { FASES_VENTANA, NOMBRE_FASE, type FaseVentana, type VentanaBackend } from '../api/convocatoriaVentanas'
import './PlazosRevisionConvocatoria.css'

interface Props {
  id_convocatoria: number
  nombre: string
  /** Cierre de la convocatoria: el primer plazo de revisión debe abrir después. */
  finConvocatoria: Date | null
  onVolver: () => void
}

interface FilaPlazo {
  activa: boolean
  abre: string
  cierra: string
}

const filaVacia = (): FilaPlazo => ({ activa: false, abre: '', cierra: '' })

const ETIQUETA_ESTADO: Record<string, string> = {
  programada: 'Programada',
  abierta: 'Abierta',
  reabierta: 'Reabierta por el Administrador',
  cerrada: 'Cerrada',
}

/** Fecha ISO → valor de un <input type="datetime-local"> en la hora local del navegador. */
function aInputLocal(iso: string): string {
  const d = new Date(iso)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

const formato = (f: Date) => f.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

/** Mismas reglas que el backend, para avisar antes de guardar. Devuelve el mensaje, o '' si todo está bien. */
function validar(filas: Record<FaseVentana, FilaPlazo>, finConvocatoria: Date | null): string {
  let anterior: { texto: string; fin: Date } | null = finConvocatoria ? { texto: 'del cierre de la convocatoria', fin: finConvocatoria } : null
  for (const fase of FASES_VENTANA) {
    const f = filas[fase]
    if (!f.activa) continue
    if (!f.abre || !f.cierra) return `${NOMBRE_FASE[fase]}: falta la fecha y hora de apertura o de cierre.`
    const abre = new Date(f.abre)
    const cierra = new Date(f.cierra)
    if (cierra <= abre) return `${NOMBRE_FASE[fase]}: el cierre debe ser posterior a la apertura.`
    if (anterior && abre < anterior.fin) return `${NOMBRE_FASE[fase]} debe abrir después ${anterior.texto} (${formato(anterior.fin)}).`
    anterior = { texto: `del cierre de ${NOMBRE_FASE[fase]}`, fin: cierra }
  }
  return ''
}

function PlazosRevisionConvocatoria({ id_convocatoria, nombre, finConvocatoria, onVolver }: Props) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [filas, setFilas] = useState<Record<FaseVentana, FilaPlazo>>({
    comite: filaVacia(),
    etica: filaVacia(),
    pares: filaVacia(),
    reclamaciones: filaVacia(),
  })
  const [guardadas, setGuardadas] = useState<Partial<Record<FaseVentana, VentanaBackend>>>({})

  const aplicar = (ventanas: VentanaBackend[]) => {
    const nuevas = { comite: filaVacia(), etica: filaVacia(), pares: filaVacia(), reclamaciones: filaVacia() }
    const porFase: Partial<Record<FaseVentana, VentanaBackend>> = {}
    for (const v of ventanas) {
      nuevas[v.fase] = { activa: true, abre: aInputLocal(v.abre_en), cierra: aInputLocal(v.cierra_en) }
      porFase[v.fase] = v
    }
    setFilas(nuevas)
    setGuardadas(porFase)
  }

  useEffect(() => {
    let cancelado = false
    ventanasApi
      .obtenerVentanas(id_convocatoria)
      .then((v) => !cancelado && aplicar(v))
      .catch((e) => !cancelado && setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los plazos.'))
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [id_convocatoria])

  const cambiar = (fase: FaseVentana, parcial: Partial<FilaPlazo>) => {
    setAviso('')
    setError('')
    setFilas((a) => ({ ...a, [fase]: { ...a[fase], ...parcial } }))
  }

  const problema = validar(filas, finConvocatoria)

  const guardar = async () => {
    setError('')
    setAviso('')
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    try {
      const r = await ventanasApi.guardarVentanas(
        id_convocatoria,
        FASES_VENTANA.filter((f) => filas[f].activa).map((fase) => ({
          fase,
          abre_en: new Date(filas[fase].abre).toISOString(),
          cierra_en: new Date(filas[fase].cierra).toISOString(),
        }))
      )
      aplicar(r.ventanas)
      setAviso('Los plazos de revisión se guardaron correctamente.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron guardar los plazos.')
    } finally {
      setGuardando(false)
    }
  }

  const cambiarReapertura = async (fase: FaseVentana, reabrir: boolean) => {
    setError('')
    setAviso('')
    try {
      const r = reabrir ? await ventanasApi.reabrirVentana(id_convocatoria, fase) : await ventanasApi.cerrarVentana(id_convocatoria, fase)
      setGuardadas(Object.fromEntries(r.ventanas.map((v) => [v.fase, v])))
      setAviso(reabrir ? `${NOMBRE_FASE[fase]} quedó reabierto. Recuerda cerrarlo cuando termine la edición.` : `${NOMBRE_FASE[fase]} volvió a regirse por sus fechas.`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cambiar el estado del plazo.')
    }
  }

  return (
    <div className="conv-registro-wrapper">
      <div className="plazos-card">
        <button type="button" className="conv-registro-volver" onClick={onVolver}>
          <ArrowLeft size={16} />
          Volver
        </button>

        <h2 className="conv-registro-title">Plazos de revisión</h2>
        <p className="plazos-convocatoria">{nombre}</p>
        <p className="plazos-ayuda">
          Define cuándo se abre y se cierra cada revisión, en orden: cada una debe abrir después de que cierra la anterior
          {finConvocatoria ? ` (la primera, después del cierre de la convocatoria: ${formato(finConvocatoria)})` : ''}. Una fase sin plazo no tiene restricción.
          Fuera de su plazo, solo el Administrador puede actuar; también puedes reabrirla mientras se hace una edición.
        </p>

        {cargando ? (
          <p className="plazos-estado">Cargando plazos...</p>
        ) : (
          <div className="plazos-lista">
            {FASES_VENTANA.map((fase, i) => {
              const f = filas[fase]
              const g = guardadas[fase]
              return (
                <div className={`plazos-fase${f.activa ? '' : ' plazos-fase-inactiva'}`} key={fase}>
                  <div className="plazos-fase-cabecera">
                    <label className="plazos-fase-titulo">
                      <input type="checkbox" checked={f.activa} onChange={(e) => cambiar(fase, { activa: e.target.checked })} />
                      <span className="plazos-fase-numero">{i + 1}</span>
                      {NOMBRE_FASE[fase]}
                    </label>
                    {g && <span className={`plazos-badge plazos-badge-${g.estado}`}>{ETIQUETA_ESTADO[g.estado]}</span>}
                  </div>

                  {f.activa && (
                    <div className="plazos-fase-campos">
                      <label>
                        Abre
                        <input type="datetime-local" value={f.abre} onChange={(e) => cambiar(fase, { abre: e.target.value })} />
                      </label>
                      <label>
                        Cierra
                        <input type="datetime-local" value={f.cierra} onChange={(e) => cambiar(fase, { cierra: e.target.value })} />
                      </label>
                      {g &&
                        (g.reabierta ? (
                          <button type="button" className="plazos-btn-reapertura plazos-btn-cerrar" onClick={() => cambiarReapertura(fase, false)}>
                            <Lock size={14} />
                            Cerrar de nuevo
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="plazos-btn-reapertura"
                            onClick={() => cambiarReapertura(fase, true)}
                            disabled={g.estado === 'abierta'}
                            title={g.estado === 'abierta' ? 'Ya está abierta' : 'Reabrir sin cambiar las fechas'}
                          >
                            <LockOpen size={14} />
                            Reabrir
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="plazos-mensaje plazos-error">{error}</p>}
        {!error && problema && !cargando && <p className="plazos-mensaje plazos-error">{problema}</p>}
        {aviso && <p className="plazos-mensaje plazos-ok">{aviso}</p>}

        <div className="conv-registro-actions">
          <button type="button" className="conv-registro-guardar" onClick={guardar} disabled={guardando || cargando || problema !== ''}>
            <Save size={16} />
            {guardando ? 'Guardando...' : 'Guardar plazos'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlazosRevisionConvocatoria
