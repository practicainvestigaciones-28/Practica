import { useState, useEffect } from 'react'
import { ArrowLeft, FilePlus, Search, SquarePen, Trash2, Save, X as XIcon } from 'lucide-react'
import DateRangeCalendar, { CalendarIcon, formatearRango } from '../../../shared/components/common/DateRangeCalendar'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import * as convocatoriasApi from '../api/convocatorias'
import type { ConvocatoriaBackend } from '../api/convocatorias'
import { ApiError } from '../../../shared/api/client'
import './Convocatorias.css'
import ConfigurarOpcionesConvocatoria from '../components/ConfigurarOpcionesConvocatoria'

interface Convocatoria {
  id: number
  nombre: string
  activa: boolean
  // El campo "estado" en BD es manual (lo mueve el switch): nada lo cierra
  // solo cuando pasa fecha_fin. "vencida" se calcula aquí para reflejarlo en
  // pantalla sin depender de que el Administrador se acuerde de apagarlo.
  vencida: boolean
  proyectos: number
  vigenciaInicio: Date | null
  vigenciaFin: Date | null
}

function mapearConvocatoria(c: ConvocatoriaBackend): Convocatoria {
  return {
    id: c.id_convocatoria,
    nombre: c.nombre,
    activa: c.estado === 'activa',
    vencida: new Date(c.fecha_fin) < new Date(),
    proyectos: c._count?.proyectos ?? 0,
    vigenciaInicio: new Date(c.fecha_inicio),
    vigenciaFin: new Date(c.fecha_fin),
  }
}

type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

function Convocatorias() {
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [vigenciaInicio, setVigenciaInicio] = useState<Date | null>(null)
  const [vigenciaFin, setVigenciaFin] = useState<Date | null>(null)
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFin, setHoraFin] = useState('23:59')
  const [modal, setModal] = useState<ModalTipo>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminarId, setEliminarId] = useState<number | null>(null)
  const [faseFormulario, setFaseFormulario] = useState<'datos' | 'opciones'>('datos')
  const [idParaOpciones, setIdParaOpciones] = useState<number | null>(null)

  const refrescar = async () => {
    try {
      const datos = await convocatoriasApi.listarConvocatorias()
      setConvocatorias(datos.map(mapearConvocatoria))
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    refrescar()
  }, [])

  const resetForm = () => {
    setNombre('')
    setVigenciaInicio(null)
    setVigenciaFin(null)
    setHoraInicio('08:00')
    setHoraFin('23:59')
  }

  const abrirFormCrear = () => {
    resetForm()
    setEditandoId(null)
    setFaseFormulario('datos')
    setModoFormulario('crear')
  }

  const formatearHora = (fecha: Date) =>
    `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`

  const abrirFormEditar = (c: Convocatoria) => {
    setNombre(c.nombre)
    setVigenciaInicio(c.vigenciaInicio)
    setVigenciaFin(c.vigenciaFin)
    setHoraInicio(c.vigenciaInicio ? formatearHora(c.vigenciaInicio) : '08:00')
    setHoraFin(c.vigenciaFin ? formatearHora(c.vigenciaFin) : '23:59')
    setEditandoId(c.id)
    setFaseFormulario('datos')
    setModoFormulario('editar')
  }

  const combinarFechaYHora = (fecha: Date, hora: string): Date => {
    const [horas, minutos] = hora.split(':').map(Number)
    const combinada = new Date(fecha)
    combinada.setHours(horas || 0, minutos || 0, 0, 0)
    return combinada
  }

  const handleGuardar = async () => {
    if (!nombre.trim() || !vigenciaInicio || !vigenciaFin) return

    setGuardando(true)
    try {
      const datos = {
        nombre: nombre.trim(),
        fecha_inicio: combinarFechaYHora(vigenciaInicio, horaInicio).toISOString(),
        fecha_fin: combinarFechaYHora(vigenciaFin, horaFin).toISOString(),
      }

      let id: number
      if (modoFormulario === 'editar' && editandoId !== null) {
        await convocatoriasApi.actualizarConvocatoria(editandoId, datos)
        id = editandoId
      } else {
        const respuesta = await convocatoriasApi.crearConvocatoria(datos)
        id = respuesta.convocatoria.id_convocatoria
      }

      await refrescar()
      setIdParaOpciones(id)
      setFaseFormulario('opciones')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la convocatoria.')
    } finally {
      setGuardando(false)
    }
  }

  const handleSeguirRegistrando = () => {
    resetForm()
    setEditandoId(null)
    setFaseFormulario('datos')
    setIdParaOpciones(null)
    setModoFormulario('crear')
    setModal(null)
  }

  const handleOk = () => {
    setModal(null)
    setModoFormulario(null)
    setEditandoId(null)
    setFaseFormulario('datos')
    setIdParaOpciones(null)
  }

  const handleCancelarClick = () => {
    setModal('cancelar')
  }

  const handleCancelarNo = () => {
    setModal(null)
  }

  const handleCancelarSi = () => {
    setModal(null)
    setModoFormulario(null)
    setEditandoId(null)
    setFaseFormulario('datos')
    setIdParaOpciones(null)
    resetForm()
  }

  const handleToggle = async (c: Convocatoria) => {
    try {
      await convocatoriasApi.cambiarEstadoConvocatoria(c.id, c.activa ? 'inactiva' : 'activa')
      await refrescar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.')
    }
  }

  const pedirEliminar = (id: number) => {
    setEliminarId(id)
  }

  const cancelarEliminar = () => {
    setEliminarId(null)
  }

  const confirmarEliminar = async () => {
    if (eliminarId !== null) {
      try {
        await convocatoriasApi.eliminarConvocatoria(eliminarId)
        await refrescar()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la convocatoria.')
      }
    }
    setEliminarId(null)
  }

  const filtradas = convocatorias.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const convocatoriaAEliminar = convocatorias.find((c) => c.id === eliminarId) ?? null

  return (
    <div className="conv-page">
      {!modoFormulario ? (
        <>
          <div className="conv-header-grande">Convocatorias</div>

          <div className="conv-list-wrapper">
            <div className="conv-toolbar">
              <button type="button" className="conv-add-btn" onClick={abrirFormCrear}>
                <FilePlus size={16} />
                Añadir convocatoria
              </button>

              <div className="conv-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar convocatoria"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            <div className="conv-list">
              {error && <p className="conv-empty">{error}</p>}
              {cargando && <p className="conv-empty">Cargando convocatorias...</p>}

              {!cargando && filtradas.map((c) => (
                <div className="conv-card" key={c.id}>
                  <span className="conv-card-nombre">
                    {c.nombre}
                    {c.vencida && <span className="conv-badge-vencida">Vencida</span>}
                  </span>

                  <div className="conv-card-proyectos">
                    <span className="conv-card-proyectos-label">Proyectos</span>
                    <span className="conv-card-proyectos-badge">{c.proyectos}</span>
                  </div>

                  <button
                    type="button"
                    className="conv-edit-btn"
                    aria-label="Editar convocatoria"
                    onClick={() => abrirFormEditar(c)}
                  >
                    <SquarePen size={16} />
                  </button>

                  <button
                    type="button"
                    className="conv-delete-btn"
                    aria-label="Eliminar convocatoria"
                    onClick={() => pedirEliminar(c.id)}
                  >
                    <Trash2 size={16} />
                  </button>

                  <label
                    className="conv-switch"
                    title={c.vencida ? 'La convocatoria ya venció y no se puede reactivar' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={c.activa && !c.vencida}
                      disabled={c.vencida}
                      onChange={() => handleToggle(c)}
                    />
                    <span className="conv-switch-slider" />
                  </label>
                </div>
              ))}

              {!cargando && !error && filtradas.length === 0 && (
                <p className="conv-empty">No se encontraron convocatorias.</p>
              )}
            </div>

            {eliminarId !== null && (
              <ConfirmModal
                mensaje={`¿Seguro que desea eliminar "${convocatoriaAEliminar?.nombre ?? 'esta convocatoria'}"?`}
                botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
                botonPrimario={{ label: 'Sí', onClick: confirmarEliminar, variante: 'rojo' }}
                onClose={cancelarEliminar}
              />
            )}
          </div>
        </>
      ) : faseFormulario === 'opciones' && idParaOpciones !== null ? (
        <div className="conv-registro-wrapper">
          <ConfigurarOpcionesConvocatoria
            id_convocatoria={idParaOpciones}
            onFinalizar={() => setModal('exito')}
            onCancelar={handleOk}
          />

          {modal === 'exito' && (
            <ConfirmModal
              mensaje={
                modoFormulario === 'editar'
                  ? 'Se han guardado los cambios exitosamente.'
                  : 'Se ha registrado la convocatoria exitosamente.'
              }
              botonSecundario={
                modoFormulario === 'crear'
                  ? { label: 'Seguir registrando', onClick: handleSeguirRegistrando, variante: 'azul' }
                  : undefined
              }
              botonPrimario={{ label: 'Ok', onClick: handleOk, variante: 'rojo' }}
              onClose={handleOk}
            />
          )}
        </div>
      ) : (
        <div className="conv-registro-wrapper">
          <div className="conv-registro-card">
            <button type="button" className="conv-registro-volver" onClick={handleCancelarClick}>
              <ArrowLeft size={16} />
              Volver
            </button>

            <h2 className="conv-registro-title">
              {modoFormulario === 'editar' ? 'Editar convocatoria' : 'Registro de convocatorias'}
            </h2>

            <div className="conv-registro-field">
              <label>Nombre de la convocatoria:</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="conv-registro-vigencia-label">
              <CalendarIcon size={16} />
              <span>Seleccione la vigencia de la convocatoria:</span>
            </div>

            <DateRangeCalendar
              inicio={vigenciaInicio}
              fin={vigenciaFin}
              onChange={(inicio, fin) => {
                setVigenciaInicio(inicio)
                setVigenciaFin(fin)
              }}
            />

            <p className="conv-registro-rango">{formatearRango(vigenciaInicio, vigenciaFin)}</p>

            <div className="conv-registro-horas">
              <div className="conv-registro-field conv-registro-field-hora">
                <label>Hora de inicio:</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="conv-registro-field conv-registro-field-hora">
                <label>Hora de cierre:</label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            </div>

            <p className="conv-registro-hora-nota">
              La convocatoria se cerrará automáticamente a esta hora en la fecha de cierre elegida.
            </p>

            <div className="conv-registro-actions">
              <button type="button" className="conv-registro-guardar" onClick={handleGuardar} disabled={guardando}>
                <Save size={16} />
                {guardando ? 'Guardando...' : 'Siguiente'}
              </button>
              <button type="button" className="conv-registro-cancelar" onClick={handleCancelarClick}>
                <XIcon size={16} />
                Cancelar
              </button>
            </div>
          </div>

          {modal === 'exito' && (
            <ConfirmModal
              mensaje={
                modoFormulario === 'editar'
                  ? 'Se han guardado los cambios exitosamente.'
                  : 'Se ha registrado la convocatoria exitosamente.'
              }
              botonSecundario={
                modoFormulario === 'crear'
                  ? { label: 'Seguir registrando', onClick: handleSeguirRegistrando, variante: 'azul' }
                  : undefined
              }
              botonPrimario={{ label: 'Ok', onClick: handleOk, variante: 'rojo' }}
              onClose={handleOk}
            />
          )}

          {modal === 'cancelar' && (
            <ConfirmModal
              mensaje="¿Seguro quiere cancelar el registro?"
              botonSecundario={{ label: 'No', onClick: handleCancelarNo, variante: 'azul' }}
              botonPrimario={{ label: 'Sí', onClick: handleCancelarSi, variante: 'rojo' }}
              onClose={handleCancelarNo}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default Convocatorias