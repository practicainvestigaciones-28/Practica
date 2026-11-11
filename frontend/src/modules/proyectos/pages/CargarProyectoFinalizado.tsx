import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Upload, X } from 'lucide-react'
import BuscadorUsuario from '../../usuarios/components/BuscadorUsuario'
import type { UsuarioBuscado } from '../../usuarios/api/usuarios'
import CampoFecha from '../../../shared/components/common/CampoFecha'
import '../../../shared/components/common/ConfirmModal.css'
import { ApiError } from '../../../shared/api/client'
import * as convocatoriasApi from '../../convocatorias/lib/convocatorias'
import {
  MAXIMO_INFORMES_AVANCE,
  guardarLecturaProyecto,
  guardarSeleccionCargaHistorica,
  tamanoLegible,
  validarPdf,
} from '../lib/cargaHistorica'
import { leerLineasDePdf } from '../lib/importar/pdf/leerPdf'
import { extraerProyectoDeLineas, type ResultadoLecturaPdfProyecto } from '../lib/importar/pdf/extraerCamposPdf'
import './CargarProyectoFinalizado.css'

interface CampoPdfProps {
  etiqueta: string
  ayuda?: string
  obligatorio?: boolean
  archivo: File | null
  onElegir: (archivo: File) => void
  onQuitar: () => void
}

/** Un espacio para anexar un PDF: muestra el nombre y el tamaño cuando ya se eligió. */
function CampoPdf({ etiqueta, ayuda, obligatorio, archivo, onElegir, onQuitar }: CampoPdfProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="cpf-doc">
      <div className="cpf-doc-info">
        <span className="cpf-doc-etiqueta">
          {etiqueta}
          {obligatorio && <span className="cpf-obligatorio"> *</span>}
        </span>
        {ayuda && <span className="cpf-doc-ayuda">{ayuda}</span>}
      </div>

      <div className="cpf-doc-accion">
        {archivo ? (
          <span className="cpf-archivo">
            <FileText size={15} />
            <span className="cpf-archivo-nombre" title={archivo.name}>
              {archivo.name}
            </span>
            <span className="cpf-archivo-tamano">{tamanoLegible(archivo.size)}</span>
            <button type="button" className="cpf-quitar" onClick={onQuitar} aria-label={`Quitar ${etiqueta}`}>
              <X size={14} />
            </button>
          </span>
        ) : (
          <button type="button" className="cpf-elegir" onClick={() => inputRef.current?.click()}>
            <Upload size={14} />
            Elegir PDF
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="cpf-input-oculto"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onElegir(f)
          }}
        />
      </div>
    </div>
  )
}

/**
 * Carga de un proyecto finalizado (anterior al sistema): el Administrador elige el investigador al que pertenece, la
 * convocatoria histórica y anexa los PDF del proyecto, el acta de inicio, los informes de avance, el informe final y
 * el acta de cierre. Estos documentos son los que el sistema leerá para llenar los campos.
 */
function CargarProyectoFinalizado() {
  const navigate = useNavigate()

  const [investigador, setInvestigador] = useState<UsuarioBuscado | null>(null)
  const [convocatorias, setConvocatorias] = useState<convocatoriasApi.ConvocatoriaBackend[]>([])
  const [idConvocatoria, setIdConvocatoria] = useState<number | null>(null)
  const [cargandoConvocatorias, setCargandoConvocatorias] = useState(true)

  const [creandoConvocatoria, setCreandoConvocatoria] = useState(false)
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevaInicio, setNuevaInicio] = useState('')
  const [nuevaFin, setNuevaFin] = useState('')
  const [guardandoConvocatoria, setGuardandoConvocatoria] = useState(false)
  const [errorConvocatoria, setErrorConvocatoria] = useState('')

  const [proyecto, setProyecto] = useState<File | null>(null)
  const [actaInicio, setActaInicio] = useState<File | null>(null)
  const [informesAvance, setInformesAvance] = useState<(File | null)[]>([null])
  const [informeFinal, setInformeFinal] = useState<File | null>(null)
  const [actaCierre, setActaCierre] = useState<File | null>(null)

  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [lectura, setLectura] = useState<ResultadoLecturaPdfProyecto | null>(null)

  useEffect(() => {
    convocatoriasApi
      .listarConvocatorias({ estado: 'cerrada' })
      .then((lista) => setConvocatorias(lista.filter((c) => c.es_historica)))
      .catch(() => setErrorConvocatoria('No se pudieron cargar las convocatorias históricas.'))
      .finally(() => setCargandoConvocatorias(false))
  }, [])

  const elegirPdf = (archivo: File, asignar: (f: File) => void) => {
    const problema = validarPdf(archivo)
    if (problema) {
      setError(problema)
      return
    }
    setError('')
    asignar(archivo)
  }

  const crearConvocatoriaHistorica = async () => {
    setErrorConvocatoria('')
    if (!nuevaNombre.trim() || !nuevaInicio || !nuevaFin) {
      setErrorConvocatoria('Escribe el nombre y elige las fechas de inicio y fin.')
      return
    }
    setGuardandoConvocatoria(true)
    try {
      const { convocatoria } = await convocatoriasApi.crearConvocatoriaHistorica({
        nombre: nuevaNombre.trim(),
        fecha_inicio: nuevaInicio,
        fecha_fin: nuevaFin,
      })
      setConvocatorias((actual) => [convocatoria, ...actual])
      setIdConvocatoria(convocatoria.id_convocatoria)
      setCreandoConvocatoria(false)
      setNuevaNombre('')
      setNuevaInicio('')
      setNuevaFin('')
    } catch (err) {
      setErrorConvocatoria(err instanceof ApiError ? err.message : 'No se pudo crear la convocatoria histórica.')
    } finally {
      setGuardandoConvocatoria(false)
    }
  }

  const continuar = async () => {
    if (!investigador) return setError('Elige el investigador al que pertenece el proyecto.')
    if (idConvocatoria === null) return setError('Elige o crea la convocatoria histórica.')
    if (!proyecto) return setError('Anexa el PDF del proyecto.')
    setError('')
    guardarSeleccionCargaHistorica({
      investigador,
      id_convocatoria: idConvocatoria,
      proyecto,
      actaInicio,
      informesAvance,
      informeFinal,
      actaCierre,
    })

    // Se lee el PDF del proyecto: lo que se reconoce por sus encabezados se muestra aquí, y lo demás se completa a mano.
    setLeyendo(true)
    try {
      const resultado = extraerProyectoDeLineas(await leerLineasDePdf(proyecto))
      guardarLecturaProyecto(resultado)
      setLectura(resultado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el PDF del proyecto.')
    } finally {
      setLeyendo(false)
    }
  }

  return (
    <div className="cpf-page">
      <button type="button" className="cpf-volver" onClick={() => navigate('/proyectos')}>
        <ArrowLeft size={16} />
        Volver
      </button>

      <div className="cpf-card">
        <h2>Cargar proyecto finalizado</h2>
        <p className="cpf-intro">
          Para proyectos anteriores al sistema que ya terminaron. Anexa los documentos en PDF: el sistema los leerá para llenar
          los campos, y podrás revisarlos y corregirlos antes de guardar. No pasan por firmas, líder, comités ni pares.
        </p>

        <section className="cpf-seccion">
          <h3>1. Investigador y convocatoria</h3>

          <div className="cpf-campo">
            <span>Investigador(a) al que pertenece el proyecto *</span>
            <BuscadorUsuario value={investigador} onChange={setInvestigador} placeholder="Busca por nombre o correo..." />
          </div>

          <div className="cpf-campo">
            <span>Convocatoria histórica *</span>
            <div className="cpf-convocatoria">
              <select
                value={idConvocatoria ?? ''}
                disabled={cargandoConvocatorias}
                onChange={(e) => setIdConvocatoria(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">
                  {cargandoConvocatorias
                    ? 'Cargando...'
                    : convocatorias.length === 0
                      ? 'No hay convocatorias históricas'
                      : 'Elige una convocatoria'}
                </option>
                {convocatorias.map((c) => (
                  <option key={c.id_convocatoria} value={c.id_convocatoria}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button type="button" className="cpf-secundario" onClick={() => setCreandoConvocatoria((v) => !v)}>
                <Plus size={14} />
                Crear convocatoria histórica
              </button>
            </div>
          </div>

          {creandoConvocatoria && (
            <div className="cpf-nueva-convocatoria">
              <input
                type="text"
                placeholder="Nombre (ej. Convocatoria 2019)"
                value={nuevaNombre}
                onChange={(e) => setNuevaNombre(e.target.value)}
              />
              <div className="cpf-fechas">
                <label>
                  <span>Inicio</span>
                  <CampoFecha value={nuevaInicio} onChange={setNuevaInicio} />
                </label>
                <label>
                  <span>Fin</span>
                  <CampoFecha value={nuevaFin} onChange={setNuevaFin} min={nuevaInicio || undefined} />
                </label>
              </div>
              <div className="cpf-nueva-acciones">
                <button type="button" className="cpf-primario" disabled={guardandoConvocatoria} onClick={crearConvocatoriaHistorica}>
                  {guardandoConvocatoria ? 'Creando...' : 'Crear y usar'}
                </button>
                <button type="button" className="cpf-secundario" onClick={() => setCreandoConvocatoria(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {errorConvocatoria && <p className="cpf-error">{errorConvocatoria}</p>}
        </section>

        <section className="cpf-seccion">
          <h3>2. Documentos en PDF</h3>

          <CampoPdf
            etiqueta="Proyecto"
            ayuda="El documento del proyecto con el formato oficial."
            obligatorio
            archivo={proyecto}
            onElegir={(f) => elegirPdf(f, setProyecto)}
            onQuitar={() => setProyecto(null)}
          />
          <CampoPdf
            etiqueta="Acta de inicio"
            archivo={actaInicio}
            onElegir={(f) => elegirPdf(f, setActaInicio)}
            onQuitar={() => setActaInicio(null)}
          />

          <div className="cpf-grupo">
            <span className="cpf-grupo-titulo">Informes de avance</span>
            <span className="cpf-doc-ayuda">Uno por cada periodo de 6 meses de la duración del proyecto.</span>
            {informesAvance.map((archivo, i) => (
              <div className="cpf-informe" key={i}>
                <CampoPdf
                  etiqueta={`Informe de avance, periodo ${i + 1}`}
                  archivo={archivo}
                  onElegir={(f) => elegirPdf(f, (x) => setInformesAvance((l) => l.map((v, j) => (j === i ? x : v))))}
                  onQuitar={() => setInformesAvance((l) => l.map((v, j) => (j === i ? null : v)))}
                />
                {informesAvance.length > 1 && i === informesAvance.length - 1 && (
                  <button type="button" className="cpf-quitar-fila" onClick={() => setInformesAvance((l) => l.slice(0, -1))}>
                    <X size={14} />
                    Quitar periodo
                  </button>
                )}
              </div>
            ))}
            {informesAvance.length < MAXIMO_INFORMES_AVANCE && (
              <button type="button" className="cpf-secundario cpf-agregar" onClick={() => setInformesAvance((l) => [...l, null])}>
                <Plus size={14} />
                Agregar informe de avance (periodo {informesAvance.length + 1})
              </button>
            )}
          </div>

          <CampoPdf
            etiqueta="Informe final"
            archivo={informeFinal}
            onElegir={(f) => elegirPdf(f, setInformeFinal)}
            onQuitar={() => setInformeFinal(null)}
          />
          <CampoPdf
            etiqueta="Acta de cierre"
            archivo={actaCierre}
            onElegir={(f) => elegirPdf(f, setActaCierre)}
            onQuitar={() => setActaCierre(null)}
          />
        </section>

        {error && <p className="cpf-error">{error}</p>}

        <div className="cpf-acciones">
          <button type="button" className="cpf-secundario" onClick={() => navigate('/proyectos')}>
            Cancelar
          </button>
          <button type="button" className="cpf-primario" disabled={leyendo} onClick={continuar}>
            {leyendo ? (
              <>
                <Loader2 size={14} className="cpf-girando" />
                Leyendo el proyecto...
              </>
            ) : (
              'Continuar'
            )}
          </button>
        </div>
      </div>

      {lectura && (
        <div className="cm-overlay">
          <div className="cm-box cpf-lectura">
            <button type="button" className="cm-close" onClick={() => setLectura(null)} aria-label="Cerrar">
              <X size={16} />
            </button>
            <h3 className="cpf-lectura-titulo">Lectura del proyecto</h3>
            <p className="cpf-lectura-texto">
              Esto fue lo que el sistema reconoció en el PDF. En la revisión podrás corregirlo y completar lo que falta.
            </p>

            <p className="cpf-lectura-dato">
              <strong>Título:</strong> {lectura.extraccion.titulo || '—'}
            </p>
            <p className="cpf-lectura-dato">
              <strong>Investigador(a) principal:</strong>{' '}
              {`${lectura.extraccion.principal.nombres} ${lectura.extraccion.principal.apellidos}`.trim() || '—'}
            </p>
            <p className="cpf-lectura-dato">
              <strong>Duración:</strong> {lectura.extraccion.duracionTexto || '—'}
            </p>

            <div className="cpf-lectura-grupo cpf-lectura-ok">
              <span className="cpf-lectura-etiqueta">
                <CheckCircle2 size={14} /> Leído ({lectura.leidos.length})
              </span>
              <span>{lectura.leidos.join(' · ')}</span>
            </div>
            {lectura.noLeidos.length > 0 && (
              <div className="cpf-lectura-grupo cpf-lectura-pendiente">
                <span className="cpf-lectura-etiqueta">
                  <AlertTriangle size={14} /> Por completar a mano ({lectura.noLeidos.length})
                </span>
                <span>{lectura.noLeidos.join(' · ')}</span>
              </div>
            )}

            <p className="cpf-lectura-texto">La pantalla de revisión y el guardado se habilitan en el siguiente paso.</p>
            <div className="cm-actions">
              <button type="button" className="cm-btn cm-btn-azul" onClick={() => setLectura(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CargarProyectoFinalizado
