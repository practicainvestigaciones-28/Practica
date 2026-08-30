import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Download, ArrowLeft } from 'lucide-react'
import './Observaciones.css'

type SeccionId = 'generales' | 'investigacion' | 'etica' | 'pares'

interface Entrada {
  texto: string
  fecha: string
  archivo?: string
}

interface Seccion {
  id: SeccionId
  label: string
  entradas: Entrada[]
}

// Datos de ejemplo — mientras el backend no esté listo.
// Cuando tu compañero conecte el fetch real, esto vendrá filtrado
// por el id del proyecto (recibido vía location.state o un parámetro de ruta).
const seccionesIniciales: Seccion[] = [
  {
    id: 'generales',
    label: 'Observaciones generales',
    entradas: [
      {
        texto:
          'El proyecto presentado no cuenta con las firmas requeridas en la documentación adjunta. Se solicita anexar las firmas correspondientes y realizar nuevamente el envío para continuar con el proceso.',
        fecha: '12/03/2026',
      },
    ],
  },
  {
    id: 'investigacion',
    label: 'Comité de investigación',
    entradas: [
      {
        texto:
          'El proyecto fue rechazado por el Comité de Investigación. Se solicita descargar el formato de evaluación correspondiente, realizar las correcciones indicadas y efectuar nuevamente el envío de la documentación ajustada.',
        fecha: '21/04/2026',
        archivo: 'formato-evaluacion.pdf',
      },
    ],
  },
  {
    id: 'etica',
    label: 'Comité de ética',
    entradas: [
      {
        texto: 'El proyecto ha pasado a evaluación por parte del Comité de Ética para su respectiva revisión y análisis.',
        fecha: '01/05/2026',
      },
    ],
  },
  {
    id: 'pares',
    label: 'Pares',
    entradas: [],
  },
]

function Observaciones() {
  const navigate = useNavigate()
  const location = useLocation()
  const tituloProyecto = (location.state as { titulo?: string })?.titulo ?? 'Proyecto'

  const [abiertas, setAbiertas] = useState<Set<SeccionId>>(
    new Set(['generales', 'investigacion', 'etica'])
  )

  const refs: Record<SeccionId, React.RefObject<HTMLDivElement | null>> = {
    generales: useRef<HTMLDivElement>(null),
    investigacion: useRef<HTMLDivElement>(null),
    etica: useRef<HTMLDivElement>(null),
    pares: useRef<HTMLDivElement>(null),
  }

  const toggleSeccion = (id: SeccionId) => {
    const nuevas = new Set(abiertas)
    if (nuevas.has(id)) {
      nuevas.delete(id)
    } else {
      nuevas.add(id)
    }
    setAbiertas(nuevas)
  }

  const irASeccion = (id: SeccionId) => {
    setAbiertas((prev) => new Set(prev).add(id))
    refs[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDescargar = (archivo: string) => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    // Aquí iría el enlace real de descarga del archivo adjunto a la observación.
    console.log('Descargar archivo (modo prueba, sin backend todavía):', archivo)
  }

  return (
    <div className="obs-page">
      <div className="obs-top">
        <button type="button" className="obs-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <h1 className="obs-titulo-proyecto">{tituloProyecto}</h1>
      </div>

      <div className="obs-tabs">
        {seccionesIniciales.map((s) => (
          <button
            key={s.id}
            type="button"
            className="obs-tab"
            onClick={() => irASeccion(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="obs-card">
        <div className="obs-card-header">OBSERVACIONES</div>

        {seccionesIniciales.map((seccion) => {
          const abierta = abiertas.has(seccion.id)

          return (
            <div className="obs-seccion" key={seccion.id} ref={refs[seccion.id]}>
              <button
                type="button"
                className="obs-seccion-header"
                onClick={() => toggleSeccion(seccion.id)}
              >
                <span>{seccion.label}</span>
                {abierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {abierta && (
                <div className="obs-seccion-body">
                  {seccion.entradas.length === 0 ? (
                    <p className="obs-empty">Todavía no hay observaciones registradas.</p>
                  ) : (
                    seccion.entradas.map((entrada, index) => (
                      <div className="obs-entrada" key={index}>
                        <p className="obs-entrada-texto">{entrada.texto}</p>

                        {entrada.archivo && (
                          <button
                            type="button"
                            className="obs-descargar-btn"
                            onClick={() => handleDescargar(entrada.archivo!)}
                          >
                            <Download size={14} />
                            Descargar
                          </button>
                        )}

                        <span className="obs-entrada-fecha">{entrada.fecha}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Observaciones