import { useState } from 'react'
import { Save, Plus } from 'lucide-react'
import './CrearProyecto.css'

type Tab =
  | 'general'
  | 'grupos'
  | 'formulacion'
  | 'marco'
  | 'cronograma'
  | 'resultados'
  | 'etico'
  | 'firmas'

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Información general' },
  { id: 'grupos', label: 'Grupos y egresados' },
  { id: 'formulacion', label: 'Formulación del proyecto' },
  { id: 'marco', label: 'Marco teórico y metodología' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'resultados', label: 'Resultados esperados' },
  { id: 'etico', label: 'Componente ético' },
  { id: 'firmas', label: 'Firmas y anexos' },
]

interface Bloque {
  id: number
}

function CrearProyecto() {
  const [tab, setTab] = useState<Tab>('general')
  const [grupos, setGrupos] = useState<Bloque[]>([{ id: 1 }])

  const handleAddGrupo = () => {
    if (grupos.length >= 3) return
    setGrupos([...grupos, { id: Date.now() }])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    // Aquí irá el fetch/POST real a /api/proyectos cuando exista el endpoint.
    console.log('Datos del proyecto (modo prueba, sin backend todavía)')
  }

  return (
    <div className="crear-proyecto">
      <h1 className="crear-proyecto-title">Registra la información de tu proyecto</h1>

      <div className="crear-proyecto-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`cp-tab ${tab === t.id ? 'cp-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="crear-proyecto-form" onSubmit={handleSubmit}>
        {tab === 'general' && <InformacionGeneral grupos={grupos} onAddGrupo={handleAddGrupo} />}
        {tab === 'grupos' && <GruposEgresados />}

        {tab !== 'general' && tab !== 'grupos' && (
          <div className="cp-placeholder">
            <p>Esta sección todavía no está construida.</p>
          </div>
        )}

        <div className="crear-proyecto-actions">
          <button type="submit" className="cp-save-btn">
            <Save size={16} />
            Guardar datos
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------- Pestaña: Información general ----------

interface InformacionGeneralProps {
  grupos: Bloque[]
  onAddGrupo: () => void
}

function InformacionGeneral({ grupos, onAddGrupo }: InformacionGeneralProps) {
  return (
    <div className="cp-section">
      <div className="cp-section-header">INFORMACIÓN GENERAL DEL PROYECTO</div>

      <div className="cp-field-row">
        <label>Título del proyecto:</label>
        <input type="text" />
      </div>

      {grupos.map((grupo, index) => (
        <div className="cp-grupo-block" key={grupo.id}>
          {grupos.length > 1 && <p className="cp-grupo-label">Grupo {index + 1}</p>}

          <div className="cp-field-row">
            <label>Investigador(a) Principal UNICESMAG:</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Dedicación:</span>
            <DedicacionToggle name={`dedicacion-principal-${grupo.id}`} opciones={['TC', 'MT', 'CT']} />
          </div>

          <div className="cp-field-row">
            <label>Co investigador(a) UNICESMAG:</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Dedicación:</span>
            <DedicacionToggle name={`dedicacion-co-${grupo.id}`} opciones={['TC', 'MT', 'CT']} />
          </div>

          <div className="cp-field-row">
            <label>Co investigador(a) Externo(a):</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Dedicación:</span>
            <DedicacionToggle name={`dedicacion-ext1-${grupo.id}`} opciones={['TC', 'MT', 'CT']} />
          </div>

          <div className="cp-field-row">
            <label>Co investigador(a) Externo(a):</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Dedicación:</span>
            <DedicacionToggle name={`dedicacion-ext2-${grupo.id}`} opciones={['TC', 'MT', 'CT']} />
          </div>

          <div className="cp-field-row">
            <label>Co investigador(a) Egresado(a) UNICESMAG:</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Cédula:</span>
            <input type="text" className="cp-cedula-input" />
          </div>

          <div className="cp-field-row">
            <label>Co investigador(a) Egresado(a) UNICESMAG:</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Cédula:</span>
            <input type="text" className="cp-cedula-input" />
          </div>

          <div className="cp-field-row">
            <label>Estudiante Investigador(a)s:</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Código estudiantil:</span>
            <DedicacionToggle name={`tipo-estudiante-${grupo.id}`} opciones={['Auxiliar', 'Asistente']} />
          </div>
        </div>
      ))}

      {grupos.length < 3 && (
        <button type="button" className="cp-add-grupo" onClick={onAddGrupo}>
          <Plus size={14} />
          Añadir otro grupo Estudiante investigador (máximo 3)
        </button>
      )}

      <div className="cp-section-header">MODALIDAD DEL PROYECTO</div>
      <div className="cp-radio-grid">
        <RadioOption name="modalidad" label="Investigación Científica" />
        <RadioOption name="modalidad" label="Desarrollo Tecnológico" />
        <RadioOption name="modalidad" label="Innovación" />
        <RadioOption name="modalidad" label="Creación Artística y Cultural" />
      </div>

      <div className="cp-section-header">ÁREA DE CONOCIMIENTO A LA QUE APLICA</div>
      <div className="cp-radio-grid cp-radio-grid-3">
        <RadioOption name="area" label="Ciencias naturales" />
        <RadioOption name="area" label="Ciencias agrícolas" />
        <RadioOption name="area" label="Ciencias Sociales" />
        <RadioOption name="area" label="Ciencias médicas y de la salud" />
        <RadioOption name="area" label="Ingeniería y Tecnología" />
        <RadioOption name="area" label="Humanidades" />
      </div>

      <div className="cp-field-row">
        <label>Programa(s) de pregrado o posgrado al que se articula:</label>
        <select defaultValue="">
          <option value="" disabled>Selecciona un programa</option>
        </select>
      </div>

      <div className="cp-field-row">
        <label>Otro:</label>
        <input type="text" />
      </div>

      <div className="cp-section-header">LUGAR DE EJECUCIÓN DEL PROYECTO</div>
      <div className="cp-field-row-3">
        <div className="cp-field-col">
          <label>Ciudad:</label>
          <select defaultValue="">
            <option value="" disabled>Selecciona una ciudad</option>
          </select>
        </div>

        <div className="cp-field-col">
          <label>Departamento:</label>
          <select defaultValue="">
            <option value="" disabled>Selecciona un departamento</option>
          </select>
        </div>

        <div className="cp-field-col">
          <label>Duración del proyecto (en periodos):</label>
          <DedicacionToggle name="duracion" opciones={['2', '4']} />
        </div>
      </div>

      <div className="cp-section-header">TIPO DE PROYECTO</div>
      <div className="cp-radio-grid">
        <RadioOption name="tipo" label="Investigación Básica:" />
        <RadioOption name="tipo" label="Investigación Aplicada:" />
      </div>

      <div className="cp-section-header">FINANCIACIÓN TOTAL SOLICITADA</div>
      <div className="cp-field-row">
        <label>Valor solicitado UNICESMAG</label>
        <input type="text" />
      </div>
      <div className="cp-field-row">
        <label>Valor contrapartida</label>
        <input type="text" />
      </div>
      <div className="cp-field-row">
        <label>Valor total</label>
        <input type="text" />
      </div>
    </div>
  )
}

// ---------- Pestaña: Grupos y egresados ----------

function GruposEgresados() {
  const [gruposCesmag, setGruposCesmag] = useState<Bloque[]>([{ id: 1 }])
  const [gruposExternos, setGruposExternos] = useState<Bloque[]>([{ id: 1 }])
  const [egresados, setEgresados] = useState<Bloque[]>([{ id: 1 }])

  return (
    <div className="cp-section">
      {/* ---- Grupo de investigación CESMAG ---- */}
      <div className="cp-section-header">
        INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN AL CUAL ESTÁ ADSCRITO EL PROYECTO EN UNICESMAG
      </div>

      {gruposCesmag.map((grupo, index) => (
        <div className="cp-grupo-block" key={grupo.id}>
          {gruposCesmag.length > 1 && <p className="cp-grupo-label">Grupo CESMAG {index + 1}</p>}

          <div className="cp-field-row">
            <label>Facultad/Departamento:</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Programa Académico:</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Nombre del Grupo:</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Líder del grupo:</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Dedicación:</span>
            <DedicacionToggle name={`dedicacion-lider-cesmag-${grupo.id}`} opciones={['TC', 'MT']} />
          </div>

          <div className="cp-field-row-4">
            <div className="cp-field-col">
              <label>Código GrupLac:</label>
              <input type="text" />
            </div>
            <div className="cp-field-col">
              <label>Reconocido por MINCIENCIAS</label>
              <DedicacionToggle name={`minciencias-cesmag-${grupo.id}`} opciones={['Si', 'No']} />
            </div>
            <div className="cp-field-col">
              <label>Categoría</label>
              <input type="text" />
            </div>
            <div className="cp-field-col">
              <label>Acuerdo Institucional</label>
              <input type="text" />
            </div>
          </div>

          <div className="cp-field-row">
            <label>Línea activa de Investigación en la cual está vinculado el proyecto:</label>
            <select defaultValue="">
              <option value="" disabled>Selecciona una línea de investigación</option>
            </select>
          </div>

          <div className="cp-field-row">
            <label>Objetivo de Desarrollo Sostenible ODS en el cual está asociado el proyecto (Obligatorio):</label>
            <select defaultValue="">
              <option value="" disabled>Selecciona una ODS</option>
            </select>
          </div>

          <InvestigadoresMiniTable idBase={`cesmag-${grupo.id}`} />
        </div>
      ))}

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() => setGruposCesmag([...gruposCesmag, { id: Date.now() }])}
      >
        <Plus size={14} />
        Añadir otro grupo de investigación CESMAG
      </button>

      {/* ---- Grupo de investigación externo ---- */}
      <div className="cp-section-header">INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN EXTERNO</div>

      {gruposExternos.map((grupo, index) => (
        <div className="cp-grupo-block" key={grupo.id}>
          {gruposExternos.length > 1 && <p className="cp-grupo-label">Grupo externo {index + 1}</p>}

          <div className="cp-field-row">
            <label>Facultad/Departamento:</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Programa Académico:</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Nombre del Grupo:</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Líder del grupo:</label>
            <input type="text" />
            <span className="cp-dedicacion-label">Dedicación:</span>
            <DedicacionToggle name={`dedicacion-lider-ext-${grupo.id}`} opciones={['TC', 'MT']} />
          </div>

          <div className="cp-field-row-4">
            <div className="cp-field-col">
              <label>Código GrupLac:</label>
              <input type="text" />
            </div>
            <div className="cp-field-col">
              <label>Reconocido por MINCIENCIAS</label>
              <DedicacionToggle name={`minciencias-ext-${grupo.id}`} opciones={['Si', 'No']} />
            </div>
            <div className="cp-field-col">
              <label>Categoría</label>
              <input type="text" />
            </div>
            <div className="cp-field-col">
              <label>Acuerdo Institucional</label>
              <input type="text" />
            </div>
          </div>

          <div className="cp-field-row">
            <label>Línea activa de Investigación en la cual está vinculado el proyecto:</label>
            <select defaultValue="">
              <option value="" disabled>Selecciona una línea de investigación</option>
            </select>
          </div>

          <div className="cp-field-row">
            <label>Línea medular Institucional en la cual está asociado el proyecto (Obligatorio):</label>
            <select defaultValue="">
              <option value="" disabled>Selecciona una línea</option>
            </select>
          </div>

          <InvestigadoresMiniTable idBase={`ext-${grupo.id}`} />
        </div>
      ))}

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() => setGruposExternos([...gruposExternos, { id: Date.now() }])}
      >
        <Plus size={14} />
        Añadir otro grupo de investigación externo
      </button>

      {/* ---- Egresados ---- */}
      <div className="cp-section-header">INFORMACIÓN GENERAL DE EGRESADOS(AS)</div>

      {egresados.map((grupo, index) => (
        <div className="cp-grupo-block" key={grupo.id}>
          {egresados.length > 1 && <p className="cp-grupo-label">Egresado(a) {index + 1}</p>}

          <div className="cp-field-row">
            <label>Facultad</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Programa Académico</label>
            <input type="text" />
          </div>
          <div className="cp-field-row">
            <label>Empresa o Entidad</label>
            <input type="text" />
          </div>

          <div className="cp-mini-table">
            <div className="cp-mini-table-header">
              <span>Co investigador(a) Egresado(a)</span>
              <span>Dedicación (Horas semanales)</span>
            </div>
            <div className="cp-mini-table-row">
              <input type="text" />
              <input type="text" />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="cp-add-grupo"
        onClick={() => setEgresados([...egresados, { id: Date.now() }])}
      >
        <Plus size={14} />
        Añadir otra información de egresados
      </button>
    </div>
  )
}

// ---------- Subcomponentes reutilizables ----------

function RadioOption({ name, label }: { name: string; label: string }) {
  return (
    <label className="cp-radio-option">
      <span>{label}</span>
      <input type="radio" name={name} />
    </label>
  )
}

function DedicacionToggle({ name, opciones }: { name: string; opciones: string[] }) {
  return (
    <div className="cp-toggle-group">
      {opciones.map((op) => (
        <label className="cp-toggle" key={op}>
          <input type="radio" name={name} value={op} />
          <span>{op}</span>
        </label>
      ))}
    </div>
  )
}

function InvestigadoresMiniTable({ idBase }: { idBase: string }) {
  const [filas, setFilas] = useState<Bloque[]>([{ id: 1 }])

  return (
    <div className="cp-mini-table">
      <div className="cp-mini-table-header">
        <span>Investigadores del proyecto</span>
        <span>Dedicación</span>
      </div>

      {filas.map((fila) => (
        <div className="cp-mini-table-row" key={fila.id}>
          <input type="text" />
          <DedicacionToggle name={`investigador-dedicacion-${idBase}-${fila.id}`} opciones={['TC', 'MT', 'CT']} />
        </div>
      ))}

      <button
        type="button"
        className="cp-add-fila"
        onClick={() => setFilas([...filas, { id: Date.now() }])}
      >
        <Plus size={12} />
        Añadir investigador
      </button>
    </div>
  )
}

export default CrearProyecto