import { useRef, useState, useEffect } from 'react'
import { Save, Plus, Download, Upload } from 'lucide-react'
import './CrearProyecto.css'
import { useNavigate } from 'react-router-dom'
import * as convocatoriasApi from '../api/convocatorias'
import * as catalogosApi from '../api/catalogos'
import * as proyectosApi from '../api/proyectos'
import { ApiError } from '../api/client'

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

interface ItemLista {
  id: number
  texto: string
}

// Datos de "Información general" que sí tienen un lugar real en el backend.
// (Los investigadores por nombre y la duración en periodos todavía NO se
// guardan — ver nota al pie del archivo, sección InformacionGeneral.)
export interface DatosGeneral {
  titulo: string
  idModalidad: number | null
  idArea: number | null
  idPrograma: number | null
  ciudad: string
  departamento: string
  idTipoProyecto: number | null
  valorSolicitado: string
  valorContrapartida: string
}

const datosGeneralIniciales: DatosGeneral = {
  titulo: '',
  idModalidad: null,
  idArea: null,
  idPrograma: null,
  ciudad: '',
  departamento: '',
  idTipoProyecto: null,
  valorSolicitado: '',
  valorContrapartida: '',
}

// "Formulación del proyecto" y "Marco teórico y metodología": van directo
// como campos de texto de Proyecto (se mandan en el mismo POST de creación).
export interface DatosTexto {
  resumen: string
  planteamiento: string
  pregunta: string
  justificacion: string
  objetivoGeneral: string
  antecedentes: ItemLista[]
  marcoTeorico: string
  metodologia: string
  funcionesEstudiante: string
}

const datosTextoIniciales: DatosTexto = {
  resumen: '',
  planteamiento: '',
  pregunta: '',
  justificacion: '',
  objetivoGeneral: '',
  antecedentes: [{ id: 1, texto: '' }],
  marcoTeorico: '',
  metodologia: '',
  funcionesEstudiante: '',
}

interface ImpactoPorObjetivo {
  impactoEsperado: string
  beneficiarioPotencial: string
  indicadorVerificable: string
}

function CrearProyecto() {
  const [tab, setTab] = useState<Tab>('general')
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState<Bloque[]>([{ id: 1 }])

  const [objetivosEspecificos, setObjetivosEspecificos] = useState<ItemLista[]>([
    { id: 1, texto: '' },
  ])
  const [datosTexto, setDatosTexto] = useState<DatosTexto>(datosTextoIniciales)
  const [impactos, setImpactos] = useState<Record<number, ImpactoPorObjetivo>>({})

  const [datosGeneral, setDatosGeneral] = useState<DatosGeneral>(datosGeneralIniciales)
  const [modalidades, setModalidades] = useState<catalogosApi.CatalogoItem[]>([])
  const [areas, setAreas] = useState<catalogosApi.CatalogoItem[]>([])
  const [tiposProyecto, setTiposProyecto] = useState<catalogosApi.CatalogoItem[]>([])
  const [programas, setProgramas] = useState<catalogosApi.ProgramaItem[]>([])
  const [idConvocatoriaActiva, setIdConvocatoriaActiva] = useState<number | null>(null)
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
        const [modalidadesRes, areasRes, tiposRes, programasRes, convocatoriasRes] = await Promise.all([
          catalogosApi.listarModalidadesProyecto(),
          catalogosApi.listarAreasConocimiento(),
          catalogosApi.listarTiposProyecto(),
          catalogosApi.listarProgramas(),
          convocatoriasApi.listarConvocatorias(),
        ])
        setModalidades(modalidadesRes)
        setAreas(areasRes)
        setTiposProyecto(tiposRes)
        setProgramas(programasRes)

        const activa = convocatoriasRes.find((c) => c.estado === 'activa')
        setIdConvocatoriaActiva(activa ? activa.id_convocatoria : null)
      } catch (err) {
        setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudieron cargar los catálogos.')
      } finally {
        setCargandoCatalogos(false)
      }
    }
    cargar()
  }, [])

  const handleAddGrupo = () => {
    if (grupos.length >= 3) return
    setGrupos([...grupos, { id: Date.now() }])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorEnvio('')

    if (!datosGeneral.titulo.trim()) {
      setErrorEnvio('El título del proyecto es obligatorio (pestaña Información general).')
      setTab('general')
      return
    }
    if (!datosGeneral.idModalidad || !datosGeneral.idTipoProyecto) {
      setErrorEnvio('Selecciona modalidad y tipo de proyecto (pestaña Información general).')
      setTab('general')
      return
    }
    if (!idConvocatoriaActiva) {
      setErrorEnvio('No hay ninguna convocatoria activa en este momento. No se puede registrar el proyecto.')
      return
    }

    setEnviando(true)
    try {
      // 1. Crear el proyecto — a partir de aquí ya existe un id_proyecto real.
      const proyecto = await proyectosApi.crearProyecto({
        id_convocatoria: idConvocatoriaActiva,
        id_modalidad_proyecto: datosGeneral.idModalidad,
        id_tipo_proyecto: datosGeneral.idTipoProyecto,
        titulo: datosGeneral.titulo.trim(),
        ciudad: datosGeneral.ciudad || undefined,
        departamento: datosGeneral.departamento || undefined,
        resumen: datosTexto.resumen || undefined,
        planteamiento_problema: datosTexto.planteamiento || undefined,
        pregunta_investigacion: datosTexto.pregunta || undefined,
        justificacion: datosTexto.justificacion || undefined,
        marco_teorico: datosTexto.marcoTeorico || undefined,
        metodologia_preliminar: datosTexto.metodologia || undefined,
        funciones_estudiante_auxiliar: datosTexto.funcionesEstudiante || undefined,
      })

      // 2. Asociaciones y contenido adicional — si el usuario los diligenció.
      const tareasExtra: Promise<unknown>[] = []
      if (datosGeneral.idArea) {
        tareasExtra.push(proyectosApi.agregarAreaProyecto(proyecto.id_proyecto, datosGeneral.idArea))
      }
      if (datosGeneral.idPrograma) {
        tareasExtra.push(proyectosApi.agregarProgramaProyecto(proyecto.id_proyecto, datosGeneral.idPrograma))
      }
      if (datosGeneral.valorSolicitado) {
        tareasExtra.push(
          proyectosApi.registrarFinanciacionProyecto(proyecto.id_proyecto, {
            valor_solicitado_unicesmag: Number(datosGeneral.valorSolicitado) || 0,
            valor_contrapartida: Number(datosGeneral.valorContrapartida) || 0,
          })
        )
      }
      for (const antecedente of datosTexto.antecedentes) {
        if (antecedente.texto.trim()) {
          tareasExtra.push(
            proyectosApi.agregarAntecedenteProyecto(proyecto.id_proyecto, antecedente.texto.trim())
          )
        }
      }
      await Promise.all(tareasExtra)

      // 3. Objetivos — el general primero, luego los específicos (los
      //    específicos necesitan quedar creados de verdad para poder
      //    asociarles su impacto con el id real que devuelve el backend).
      if (datosTexto.objetivoGeneral.trim()) {
        await proyectosApi.agregarObjetivoProyecto(proyecto.id_proyecto, 'general', datosTexto.objetivoGeneral.trim())
      }

      for (const obj of objetivosEspecificos) {
        if (!obj.texto.trim()) continue
        const creado = await proyectosApi.agregarObjetivoProyecto(proyecto.id_proyecto, 'especifico', obj.texto.trim())
        const impacto = impactos[obj.id]
        if (impacto && (impacto.impactoEsperado || impacto.beneficiarioPotencial || impacto.indicadorVerificable)) {
          await proyectosApi.agregarImpactoObjetivo(proyecto.id_proyecto, creado.id_objetivo, {
            impacto_esperado: impacto.impactoEsperado || 'No especificado',
            beneficiario_potencial: impacto.beneficiarioPotencial || undefined,
            indicador_verificable: impacto.indicadorVerificable || undefined,
          })
        }
      }

      navigate('/proyectos')
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo registrar el proyecto.')
    } finally {
      setEnviando(false)
    }
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

      {errorEnvio && <p className="cp-form-error">{errorEnvio}</p>}

      <form className="crear-proyecto-form" onSubmit={handleSubmit}>
        {tab === 'general' && (
          <InformacionGeneral
            grupos={grupos}
            onAddGrupo={handleAddGrupo}
            datos={datosGeneral}
            setDatos={setDatosGeneral}
            modalidades={modalidades}
            areas={areas}
            tiposProyecto={tiposProyecto}
            programas={programas}
            cargando={cargandoCatalogos}
          />
        )}
        {tab === 'grupos' && <GruposEgresados />}
        {tab === 'formulacion' && (
          <FormulacionProyecto
            objetivosEspecificos={objetivosEspecificos}
            setObjetivosEspecificos={setObjetivosEspecificos}
            datos={datosTexto}
            setDatos={setDatosTexto}
          />
        )}
        {tab === 'marco' && (
          <MarcoTeoricoMetodologia
            objetivosEspecificos={objetivosEspecificos}
            datos={datosTexto}
            setDatos={setDatosTexto}
            impactos={impactos}
            setImpactos={setImpactos}
          />
        )}
        {tab === 'cronograma' && <Cronograma />}
        {tab === 'resultados' && <ResultadosEsperados />}
        {tab === 'etico' && <ComponenteEtico datos={datosTexto} setDatos={setDatosTexto} />}
        {tab === 'firmas' && <FirmasAnexos />}

        <div className="crear-proyecto-actions">
          <button type="submit" className="cp-save-btn" disabled={enviando}>
            <Save size={16} />
            {enviando ? 'Guardando...' : 'Guardar datos'}
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
  datos: DatosGeneral
  setDatos: React.Dispatch<React.SetStateAction<DatosGeneral>>
  modalidades: catalogosApi.CatalogoItem[]
  areas: catalogosApi.CatalogoItem[]
  tiposProyecto: catalogosApi.CatalogoItem[]
  programas: catalogosApi.ProgramaItem[]
  cargando: boolean
}

function InformacionGeneral({
  grupos,
  onAddGrupo,
  datos,
  setDatos,
  modalidades,
  areas,
  tiposProyecto,
  programas,
  cargando,
}: InformacionGeneralProps) {
  const valorTotal =
    (Number(datos.valorSolicitado) || 0) + (Number(datos.valorContrapartida) || 0)

  return (
    <div className="cp-section">
      <div className="cp-section-header">INFORMACIÓN GENERAL DEL PROYECTO</div>

      <div className="cp-field-row">
        <label>Título del proyecto:</label>
        <input
          type="text"
          value={datos.titulo}
          onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
        />
      </div>

      {/*
        ⚠️ PENDIENTE — estos campos de investigadores son texto libre, pero
        el backend necesita el ID real de un usuario ya registrado
        (POST /api/proyectos/:id/participantes espera { participante: number, ... }).
        Falta un componente de buscar/seleccionar usuario (autocompletar)
        antes de poder conectar esto. Por ahora se puede escribir aquí pero
        NO se envía ni se guarda en la base de datos todavía.
      */}
      <p className="cp-nota-pendiente">
        ⚠️ Los investigadores todavía no se guardan — falta un buscador de usuarios reales.
      </p>

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
        {cargando && <p>Cargando modalidades...</p>}
        {modalidades.map((m) => (
          <RadioOption
            key={m.id_modalidad}
            name="modalidad"
            label={m.nombre}
            checked={datos.idModalidad === m.id_modalidad}
            onChange={() => setDatos({ ...datos, idModalidad: m.id_modalidad! })}
          />
        ))}
      </div>

      <div className="cp-section-header">ÁREA DE CONOCIMIENTO A LA QUE APLICA</div>
      <div className="cp-radio-grid cp-radio-grid-3">
        {areas.map((a) => (
          <RadioOption
            key={a.id_area_conocimiento}
            name="area"
            label={a.nombre}
            checked={datos.idArea === a.id_area_conocimiento}
            onChange={() => setDatos({ ...datos, idArea: a.id_area_conocimiento! })}
          />
        ))}
      </div>

      <div className="cp-field-row">
        <label>Programa(s) de pregrado o posgrado al que se articula:</label>
        <select
          value={datos.idPrograma ?? ''}
          onChange={(e) => setDatos({ ...datos, idPrograma: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Selecciona un programa</option>
          {programas.map((p) => (
            <option key={p.id_programa} value={p.id_programa}>
              {p.nombre}
            </option>
          ))}
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
          <input
            type="text"
            value={datos.ciudad}
            onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })}
            placeholder="Ej. Pasto"
          />
        </div>

        <div className="cp-field-col">
          <label>Departamento:</label>
          <input
            type="text"
            value={datos.departamento}
            onChange={(e) => setDatos({ ...datos, departamento: e.target.value })}
            placeholder="Ej. Nariño"
          />
        </div>

        <div className="cp-field-col">
          <label>Duración del proyecto (en periodos):</label>
          <DedicacionToggle name="duracion" opciones={['2', '4']} />
        </div>
      </div>

      <div className="cp-section-header">TIPO DE PROYECTO</div>
      <div className="cp-radio-grid">
        {tiposProyecto.map((t) => (
          <RadioOption
            key={t.id_tipo_proyecto}
            name="tipo"
            label={t.nombre}
            checked={datos.idTipoProyecto === t.id_tipo_proyecto}
            onChange={() => setDatos({ ...datos, idTipoProyecto: t.id_tipo_proyecto! })}
          />
        ))}
      </div>

      <div className="cp-section-header">FINANCIACIÓN TOTAL SOLICITADA</div>
      <div className="cp-field-row">
        <label>Valor solicitado UNICESMAG</label>
        <input
          type="number"
          value={datos.valorSolicitado}
          onChange={(e) => setDatos({ ...datos, valorSolicitado: e.target.value })}
        />
      </div>
      <div className="cp-field-row">
        <label>Valor contrapartida</label>
        <input
          type="number"
          value={datos.valorContrapartida}
          onChange={(e) => setDatos({ ...datos, valorContrapartida: e.target.value })}
        />
      </div>
      <div className="cp-field-row">
        <label>Valor total</label>
        <input type="text" value={valorTotal ? valorTotal.toLocaleString('es-CO') : ''} readOnly />
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

// ---------- Pestaña: Formulación del proyecto ----------

interface FormulacionProyectoProps {
  objetivosEspecificos: ItemLista[]
  setObjetivosEspecificos: (items: ItemLista[]) => void
  datos: DatosTexto
  setDatos: React.Dispatch<React.SetStateAction<DatosTexto>>
}

function FormulacionProyecto({
  objetivosEspecificos,
  setObjetivosEspecificos,
  datos,
  setDatos,
}: FormulacionProyectoProps) {
  const actualizarItem = (
    lista: ItemLista[],
    setLista: (items: ItemLista[]) => void,
    id: number,
    texto: string
  ) => {
    setLista(lista.map((item) => (item.id === id ? { ...item, texto } : item)))
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">RESÚMEN</div>
      <TextareaConContador
        value={datos.resumen}
        onChange={(v) => setDatos({ ...datos, resumen: v })}
        maxLength={300}
      />

      <div className="cp-section-header">DESCRIPCIÓN DEL PROYECTO</div>

      <div className="cp-subheader">Planteamiento del problema</div>
      <TextareaConContador
        value={datos.planteamiento}
        onChange={(v) => setDatos({ ...datos, planteamiento: v })}
        maxLength={600}
        placeholder="Al menos 2 citas con sus correspondientes referencias"
      />

      <div className="cp-subheader">Pregunta de investigación</div>
      <textarea
        className="cp-textarea"
        value={datos.pregunta}
        onChange={(e) => setDatos({ ...datos, pregunta: e.target.value })}
        placeholder="Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio"
      />

      <div className="cp-subheader">Justificación</div>
      <TextareaConContador
        value={datos.justificacion}
        onChange={(v) => setDatos({ ...datos, justificacion: v })}
        maxLength={500}
      />

      <div className="cp-subheader">Objetivo general</div>
      <textarea
        className="cp-textarea"
        value={datos.objetivoGeneral}
        onChange={(e) => setDatos({ ...datos, objetivoGeneral: e.target.value })}
      />

      <div className="cp-subheader">Objetivos específicos</div>
      {objetivosEspecificos.map((item, index) => (
        <div className="cp-numbered-item" key={item.id}>
          <span className="cp-numbered-index">{index + 1}.</span>
          <textarea
            className="cp-textarea cp-textarea-numbered"
            value={item.texto}
            onChange={(e) =>
              actualizarItem(objetivosEspecificos, setObjetivosEspecificos, item.id, e.target.value)
            }
          />
        </div>
      ))}
      <button
        type="button"
        className="cp-add-grupo"
        onClick={() =>
          setObjetivosEspecificos([...objetivosEspecificos, { id: Date.now(), texto: '' }])
        }
      >
        <Plus size={14} />
        Añadir otro objetivo específico
      </button>

      <div className="cp-subheader">Antecedentes</div>
      {datos.antecedentes.map((item) => (
        <textarea
          key={item.id}
          className="cp-textarea"
          value={item.texto}
          onChange={(e) =>
            setDatos({
              ...datos,
              antecedentes: datos.antecedentes.map((a) => (a.id === item.id ? { ...a, texto: e.target.value } : a)),
            })
          }
          placeholder="Preferiblemente de los últimos 5 años"
        />
      ))}
      {datos.antecedentes.length < 5 && (
        <button
          type="button"
          className="cp-add-grupo"
          onClick={() =>
            setDatos({ ...datos, antecedentes: [...datos.antecedentes, { id: Date.now(), texto: '' }] })
          }
        >
          <Plus size={14} />
          Añadir otro antecedente máx(5)
        </button>
      )}
    </div>
  )
}

// ---------- Pestaña: Marco teórico y metodología ----------

interface MarcoTeoricoMetodologiaProps {
  objetivosEspecificos: ItemLista[]
  datos: DatosTexto
  setDatos: React.Dispatch<React.SetStateAction<DatosTexto>>
  impactos: Record<number, ImpactoPorObjetivo>
  setImpactos: React.Dispatch<React.SetStateAction<Record<number, ImpactoPorObjetivo>>>
}

function MarcoTeoricoMetodologia({
  objetivosEspecificos,
  datos,
  setDatos,
  impactos,
  setImpactos,
}: MarcoTeoricoMetodologiaProps) {
  const getImpacto = (id: number): ImpactoPorObjetivo =>
    impactos[id] ?? { impactoEsperado: '', beneficiarioPotencial: '', indicadorVerificable: '' }

  const actualizarImpacto = (id: number, campo: keyof ImpactoPorObjetivo, valor: string) => {
    setImpactos({
      ...impactos,
      [id]: { ...getImpacto(id), [campo]: valor },
    })
  }

  const filas: { key: keyof ImpactoPorObjetivo; label: string }[] = [
    { key: 'impactoEsperado', label: 'Impacto esperado' },
    { key: 'beneficiarioPotencial', label: 'Beneficiario potencial' },
    { key: 'indicadorVerificable', label: 'Indicador verificable' },
  ]

  return (
    <div className="cp-section">
      <div className="cp-section-header">
        MARCO TEÓRICO PRELIMINAR (MÁXIMO 2000 PALABRAS Y AL MENOS 10 CITAS CON SUS CORRESPONDIENTES
        REFERENCIAS PREFERIBLEMENTE DE LOS ÚLTIMOS 5 AÑOS)
      </div>
      <TextareaConContador
        value={datos.marcoTeorico}
        onChange={(v) => setDatos({ ...datos, marcoTeorico: v })}
        maxLength={2000}
        placeholder="Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio"
      />

      <div className="cp-section-header">METODOLOGÍA PRELIMINAR PROPUESTA</div>
      <textarea
        className="cp-textarea"
        value={datos.metodologia}
        onChange={(e) => setDatos({ ...datos, metodologia: e.target.value })}
        placeholder="Mencionar Paradigma, Enfoque, Método, Técnicas de recolección de información y demás aspectos pertinentes al enfoque. Además, determinar las acciones por cada objetivo específico"
      />

      <div className="cp-section-header">IMPACTO (POR CADA OBJETIVO ESPECÍFICO)</div>

      {objetivosEspecificos.length === 0 ? (
        <p className="cp-hint-text">
          Registra al menos un objetivo específico en la pestaña "Formulación del proyecto" para
          completar esta tabla.
        </p>
      ) : (
        <table className="cp-impacto-table">
          <tbody>
            {filas.map(({ key, label }) => (
              <tr key={key}>
                <td className="cp-impacto-label" rowSpan={objetivosEspecificos.length}>
                  {label}
                </td>
                {objetivosEspecificos.map((obj, index) => (
                  <td className="cp-impacto-value" key={obj.id}>
                    <span className="cp-impacto-ob-tag">OB. E. {index + 1}</span>
                    <input
                      type="text"
                      value={getImpacto(obj.id)[key]}
                      onChange={(e) => actualizarImpacto(obj.id, key, e.target.value)}
                      placeholder={obj.texto || `Objetivo específico ${index + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="cp-section-header">REFERENCIAS</div>
      {/* ⚠️ PENDIENTE — no existe tabla de "referencias" en el backend
          todavía; este campo se puede escribir pero no se guarda. */}
      <p className="cp-nota-pendiente">⚠️ Las referencias todavía no se guardan (falta esa tabla en el backend).</p>
      <textarea
        className="cp-textarea"
        placeholder="Mencionar Paradigma, Enfoque, Método, Técnicas de recolección de información y demás aspectos pertinentes al enfoque. Además, determinar las acciones por cada objetivo específico"
      />
    </div>
  )
}

// ---------- Pestaña: Cronograma ----------

interface ActividadCronograma {
  id: number
  actividad: string
  resultado: string
  responsable: string
  anio: string
  meses: boolean[]
}

interface CronogramaBloque {
  id: number
  actividades: ActividadCronograma[]
}

function crearActividadVacia(): ActividadCronograma {
  return {
    id: Date.now() + Math.random(),
    actividad: '',
    resultado: '',
    responsable: '',
    anio: '2025',
    meses: [false, false, false, false, false, false],
  }
}

function Cronograma() {
  const [cronogramas, setCronogramas] = useState<CronogramaBloque[]>([
    { id: 1, actividades: [crearActividadVacia()] },
  ])

  const addCronograma = () => {
    setCronogramas([...cronogramas, { id: Date.now(), actividades: [crearActividadVacia()] }])
  }

  const addActividad = (cronogramaId: number) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id === cronogramaId ? { ...c, actividades: [...c.actividades, crearActividadVacia()] } : c
      )
    )
  }

  const actualizarActividad = (
    cronogramaId: number,
    actividadId: number,
    campo: 'actividad' | 'resultado' | 'responsable' | 'anio',
    valor: string
  ) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id !== cronogramaId
          ? c
          : {
              ...c,
              actividades: c.actividades.map((a) =>
                a.id === actividadId ? { ...a, [campo]: valor } : a
              ),
            }
      )
    )
  }

  const toggleMes = (cronogramaId: number, actividadId: number, mesIndex: number) => {
    setCronogramas(
      cronogramas.map((c) =>
        c.id !== cronogramaId
          ? c
          : {
              ...c,
              actividades: c.actividades.map((a) => {
                if (a.id !== actividadId) return a
                const nuevosMeses = [...a.meses]
                nuevosMeses[mesIndex] = !nuevosMeses[mesIndex]
                return { ...a, meses: nuevosMeses }
              }),
            }
      )
    )
  }

  return (
    <div className="cp-section">
      {cronogramas.map((cronograma, cIndex) => (
        <div key={cronograma.id}>
          <div className="cp-section-header">CRONOGRAMA DE ACTIVIDADES</div>

          <table className="cp-cronograma-table">
            <thead>
              <tr>
                <th rowSpan={2}>Actividad</th>
                <th rowSpan={2}>Resultado</th>
                <th rowSpan={2}>Responsable</th>
                <th colSpan={6}>
                  <div className="cp-periodo-header">
                    <span>Periodo {cIndex + 1} - Año</span>
                    <select
                      value={cronograma.actividades[0]?.anio}
                      onChange={(e) =>
                        cronograma.actividades.forEach((a) =>
                          actualizarActividad(cronograma.id, a.id, 'anio', e.target.value)
                        )
                      }
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                    <span>/Mes</span>
                  </div>
                </th>
              </tr>
              <tr>
                {[1, 2, 3, 4, 5, 6].map((mes) => (
                  <th key={mes} className="cp-mes-header">{mes}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {cronograma.actividades.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="text"
                      value={a.actividad}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'actividad', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={a.resultado}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'resultado', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={a.responsable}
                      onChange={(e) => actualizarActividad(cronograma.id, a.id, 'responsable', e.target.value)}
                    />
                  </td>
                  {a.meses.map((marcado, mesIndex) => (
                    <td key={mesIndex} className="cp-mes-cell">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggleMes(cronograma.id, a.id, mesIndex)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="cp-add-grupo"
            onClick={() => addActividad(cronograma.id)}
          >
            <Plus size={14} />
            Añadir otra actividad
          </button>
        </div>
      ))}

      <button type="button" className="cp-add-grupo cp-add-cronograma" onClick={addCronograma}>
        <Plus size={14} />
        Añadir otro cronograma
      </button>
    </div>
  )
}

// ---------- Pestaña: Resultados esperados ----------

interface CategoriaProductos {
  categoria: string
  items?: string[]
  nota?: string
}

interface SeccionProductos {
  titulo: string
  subtitulo: string
  categorias: CategoriaProductos[]
}

const seccionesResultados: SeccionProductos[] = [
  {
    titulo: 'Generación de nuevo conocimiento',
    subtitulo: '(Selección obligatoria)',
    categorias: [
      {
        categoria: 'Artículos de investigación',
        items: ['A1', 'A2', 'B'],
        nota: 'Nota: Se sugiere que la categorización de la revista esté asociada a un cuartil Q1, Q2, Q3 o Q4 de JCR o SJR.',
      },
      {
        categoria: 'Productos tecnológicos patentados o en proceso de concesión de la patente',
        items: ['Patente de invención', 'Patente de modelo de utilidad'],
      },
      { categoria: 'Variedad vegetal' },
      { categoria: 'Nueva raza animal' },
      {
        categoria: 'Obras o productos de investigación-creación en artes, arquitectura y diseño',
        items: [
          'Obra o creación efímera (vitrinismo, producto gráfico)',
          'Obra o creación permanente (producto gráfico, fotografía, cómic, video y diseño de personaje)',
          'Obra o creación procesal (programas de proyección o innovación social, story board, método pedagógico, direcciones y consultorías de proyectos)',
        ],
      },
    ],
  },
  {
    titulo: 'Formación de Recurso Humano en CTeI',
    subtitulo: '(Selección obligatoria)',
    categorias: [
      { categoria: 'Dirección Tesis de doctorado' },
      { categoria: 'Dirección Trabajo de Grado de maestría' },
      { categoria: 'Dirección Trabajo de Grado de pregrado' },
      {
        categoria:
          'Proyecto investigación y desarrollo, Investigación-creación, Desarrollo e Innovación I+D+I (con acto administrativo en el cual se asigna recurso externo)',
      },
      { categoria: 'Proyecto de extensión y responsabilidad social en CTI (que involucre soluciones)' },
      { categoria: 'Apoyo a programas y cursos de formación de investigadores (Acto administrativo)' },
      { categoria: 'Acompañamiento y asesoría de línea temática del programa Ondas (Aval del programa Ondas)' },
    ],
  },
  {
    titulo: 'Desarrollo tecnológico e innovación',
    subtitulo: '(Selección opcional)',
    categorias: [
      {
        categoria: 'Productos tecnológicos certificados o validados',
        items: [
          'Diseño Industrial',
          'Esquema de Circuito integrado',
          'Software',
          'Planta piloto',
          'Prototipo industrial',
          'Signos distintivos',
          'Patente de invención',
          'Patente de modelo de utilidad',
        ],
      },
      {
        categoria: 'Productos empresariales',
        items: [
          'Secreto empresarial',
          'Empresas de base tecnológica',
          'Productos o procesos tecnológicos usualmente no patentables o registrables',
          'Innovación generada en gestión empresarial',
          'Innovaciones en procedimientos y servicios',
        ],
      },
      {
        categoria: 'Regulaciones, normas, reglamentos o legislaciones',
        items: ['Norma técnica', 'Reglamento técnico', 'Guía de práctica clínica', 'Proyecto de ley'],
      },
      {
        categoria: 'Consultorías e informes técnicos finales',
        items: ['Consultorías científico-tecnológicas', 'Consultoría en arte, arquitectura y diseño'],
      },
      { categoria: 'Acuerdos de licencia para la explotación de obras protegidas por derecho de autor' },
    ],
  },
  {
    titulo: 'Apropiación social del conocimiento',
    subtitulo: '(Selección Opcional)',
    categorias: [
      {
        categoria: 'Comunicación con enfoque en las relaciones entre ciencia, tecnología y sociedad',
        items: [
          'Estrategias de comunicación de conocimiento (certificación)',
          'Generación de contenidos impresos, radiales, audiovisuales, multimedia, virtuales y creative commons',
          'Edición de revista o libro de divulgación científica (certificación)',
        ],
      },
      {
        categoria: 'Estrategia pedagógica para el fomento de la CTeI',
        items: [
          'Programa/ estrategia pedagógica para el fomento de la CTeI (certificación)',
          'Alianzas con centros dedicados a la apropiación social del conocimiento',
        ],
      },
      {
        categoria: 'Participación ciudadana en CTeI',
        items: [
          'Participación ciudadana en CTeI (constancia de participación)',
          'Espacio de participación ciudadana en CTeI (constancia de participación)',
        ],
      },
      {
        categoria: 'Circulación de conocimiento especializado',
        items: [
          'Evento científico con componente de apropiación (certificación)',
          'Participación en red de conocimiento (certificación)',
          'Talleres de creación (certificación)',
          'Eventos artísticos de arquitectura o de diseño con componentes de apropiación (certificación)',
          'Documentos de trabajo',
          'Boletín divulgativo de resultados de investigación',
        ],
      },
      {
        categoria:
          'Reconocimientos nacionales o internacionales por procesos de apropiación social del conocimiento',
        items: ['Premios o distinciones (certificación)'],
      },
    ],
  },
]

function ResultadosEsperados() {
  return (
    <div className="cp-section">
      {seccionesResultados.map((seccion) => (
        <div key={seccion.titulo}>
          <div className="cp-section-header cp-resultados-header">
            {seccion.titulo}
            <span className="cp-resultados-subtitulo">{seccion.subtitulo}</span>
          </div>

          <table className="cp-resultados-table">
            <thead>
              <tr>
                <th colSpan={2}>Categoría</th>
                <th className="cp-resultados-th-numero">Número de productos</th>
              </tr>
            </thead>
            <tbody>
              {seccion.categorias.map((cat) => {
                if (!cat.items || cat.items.length === 0) {
                  return (
                    <tr key={cat.categoria}>
                      <td colSpan={2}>{cat.categoria}</td>
                      <td className="cp-resultados-td-numero">
                        <input type="number" min={0} />
                      </td>
                    </tr>
                  )
                }

                const filas = cat.nota ? cat.items.length + 1 : cat.items.length

                return (
                  <>
                    {cat.items.map((item, index) => (
                      <tr key={`${cat.categoria}-${item}`}>
                        {index === 0 && (
                          <td className="cp-resultados-categoria" rowSpan={filas}>
                            {cat.categoria}
                          </td>
                        )}
                        <td>{item}</td>
                        <td className="cp-resultados-td-numero">
                          <input type="number" min={0} />
                        </td>
                      </tr>
                    ))}

                    {cat.nota && (
                      <tr key={`${cat.categoria}-nota`}>
                        <td colSpan={2} className="cp-resultados-nota">
                          {cat.nota}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ---------- Pestaña: Componente ético ----------

function ComponenteEtico({ datos, setDatos }: { datos: DatosTexto; setDatos: React.Dispatch<React.SetStateAction<DatosTexto>> }) {
  return (
    <div className="cp-section">
      <div className="cp-section-header">Componente ético</div>

      <div className="cp-etico-info">
        <p>(Determinar si se va o no a utilizar consentimiento informado)</p>
        <p>(Determinar si se va o no a utilizar asentimiento informado)</p>
        <p>(Determinar si se puede colocar en riesgo a seres humanos y medio ambiente)</p>
        <p className="cp-etico-nota">
          Nota. Todos los proyectos de investigación que interactúen con personas, deben incluir
          el formato de consentimiento informado y si son menores de edad el formato de
          asentimiento
        </p>
      </div>

      <div className="cp-section-header">Funciones del estudiante auxiliar o asistente en la investigación</div>
      <TextareaConContador
        value={datos.funcionesEstudiante}
        onChange={(v) => setDatos({ ...datos, funcionesEstudiante: v })}
        maxLength={500}
      />
    </div>
  )
}

// ---------- Pestaña: Firmas y anexos ----------

interface HojaDeVida {
  id: number
  nombres: string
  apellidos: string
  lugarFechaNacimiento: string
  nacionalidad: string
  tipoDocumento: string
  numeroDocumento: string
  direccion: string
  correo: string
  telefono: string
  celular: string
  cargoActual: string
  cargosDesempenados: string
  titulosAcademicos: string
  produccionCientifica: string
}

function crearHojaVidaVacia(): HojaDeVida {
  return {
    id: Date.now() + Math.random(),
    nombres: '',
    apellidos: '',
    lugarFechaNacimiento: '',
    nacionalidad: '',
    tipoDocumento: '',
    numeroDocumento: '',
    direccion: '',
    correo: '',
    telefono: '',
    celular: '',
    cargoActual: '',
    cargosDesempenados: '',
    titulosAcademicos: '',
    produccionCientifica: '',
  }
}

function FirmasAnexos() {
  const [hojasVida, setHojasVida] = useState<HojaDeVida[]>([crearHojaVidaVacia()])

  const [formatoFirmado, setFormatoFirmado] = useState<File | null>(null)
  const [formatoEtica, setFormatoEtica] = useState<File | null>(null)
  const inputFirmadoRef = useRef<HTMLInputElement>(null)
  const inputEticaRef = useRef<HTMLInputElement>(null)

  const actualizarHoja = (id: number, campo: keyof HojaDeVida, valor: string) => {
    setHojasVida(hojasVida.map((h) => (h.id === id ? { ...h, [campo]: valor } : h)))
  }

  const addHojaVida = () => {
    setHojasVida([...hojasVida, crearHojaVidaVacia()])
  }

  const handleDescargarFormato = () => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    // Aquí iría el enlace real de descarga de la plantilla del proyecto en formato Word/PDF.
    console.log('Descargar plantilla de proyecto (modo prueba, sin backend todavía)')
  }

  return (
    <div className="cp-section">
      <div className="cp-section-header">
        HOJAS DE VIDA INVESTIGADORES
        <br />
        (se diligencia una ficha por cada investigador)
      </div>

      {hojasVida.map((hoja, index) => (
        <div className="cp-grupo-block" key={hoja.id}>
          <div className="cp-section-header cp-hv-header">HOJA DE VIDA (Resumen)</div>
          <div className="cp-subheader">
            {index === 0 ? 'Información investigador(a) principal' : 'Información co-investigador(a)'}
          </div>

          <div className="cp-field-row">
            <label>Nombres</label>
            <input
              type="text"
              value={hoja.nombres}
              onChange={(e) => actualizarHoja(hoja.id, 'nombres', e.target.value)}
            />
          </div>
          <div className="cp-field-row">
            <label>Apellidos</label>
            <input
              type="text"
              value={hoja.apellidos}
              onChange={(e) => actualizarHoja(hoja.id, 'apellidos', e.target.value)}
            />
          </div>

          <div className="cp-field-row-4">
            <div className="cp-field-col">
              <label>Lugar y fecha de Nacimiento</label>
              <input
                type="text"
                value={hoja.lugarFechaNacimiento}
                onChange={(e) => actualizarHoja(hoja.id, 'lugarFechaNacimiento', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Nacionalidad</label>
              <input
                type="text"
                value={hoja.nacionalidad}
                onChange={(e) => actualizarHoja(hoja.id, 'nacionalidad', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Tipo documento de identidad</label>
              <input
                type="text"
                value={hoja.tipoDocumento}
                onChange={(e) => actualizarHoja(hoja.id, 'tipoDocumento', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>No. Documento de identidad</label>
              <input
                type="text"
                value={hoja.numeroDocumento}
                onChange={(e) => actualizarHoja(hoja.id, 'numeroDocumento', e.target.value)}
              />
            </div>
          </div>

          <div className="cp-field-row-2">
            <div className="cp-field-col">
              <label>Dirección de residencia</label>
              <input
                type="text"
                value={hoja.direccion}
                onChange={(e) => actualizarHoja(hoja.id, 'direccion', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={hoja.correo}
                onChange={(e) => actualizarHoja(hoja.id, 'correo', e.target.value)}
              />
            </div>
          </div>

          <div className="cp-field-row-2">
            <div className="cp-field-col">
              <label>Teléfono</label>
              <input
                type="text"
                value={hoja.telefono}
                onChange={(e) => actualizarHoja(hoja.id, 'telefono', e.target.value)}
              />
            </div>
            <div className="cp-field-col">
              <label>Celular</label>
              <input
                type="text"
                value={hoja.celular}
                onChange={(e) => actualizarHoja(hoja.id, 'celular', e.target.value)}
              />
            </div>
          </div>

          <div className="cp-subheader">Cargo actual</div>
          <textarea
            className="cp-textarea"
            value={hoja.cargoActual}
            onChange={(e) => actualizarHoja(hoja.id, 'cargoActual', e.target.value)}
          />

          <div className="cp-subheader">Cargos desempeñados</div>
          <textarea
            className="cp-textarea"
            value={hoja.cargosDesempenados}
            onChange={(e) => actualizarHoja(hoja.id, 'cargosDesempenados', e.target.value)}
          />

          <div className="cp-subheader">Títulos académicos obtenidos (área, disciplina, universidad, año)</div>
          <textarea
            className="cp-textarea"
            value={hoja.titulosAcademicos}
            onChange={(e) => actualizarHoja(hoja.id, 'titulosAcademicos', e.target.value)}
          />

          <div className="cp-subheader">
            Producción científica y académica (las 5 más importantes en los últimos 5 años)
          </div>
          <textarea
            className="cp-textarea"
            value={hoja.produccionCientifica}
            onChange={(e) => actualizarHoja(hoja.id, 'produccionCientifica', e.target.value)}
          />
        </div>
      ))}

      <button type="button" className="cp-add-grupo" onClick={addHojaVida}>
        <Plus size={14} />
        Añadir otra información co-investigador(a)
      </button>

      <div className="cp-section-header">PROYECTO EN FORMATO</div>
      <button type="button" className="cp-descargar-btn" onClick={handleDescargarFormato}>
        <Download size={16} />
        Descargar
      </button>

      <div className="cp-section-header">Cargue de documentos</div>

      <div className="cp-documentos-table">
        <div className="cp-documentos-row">
          <span>Formato de proyecto firmado</span>
          <button type="button" className="cp-cargar-btn" onClick={() => inputFirmadoRef.current?.click()}>
            <Upload size={14} />
            {formatoFirmado ? formatoFirmado.name : 'Cargar'}
          </button>
          <input
            ref={inputFirmadoRef}
            type="file"
            className="cp-file-input"
            onChange={(e) => setFormatoFirmado(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="cp-documentos-row">
          <span>Formato de ética</span>
          <button type="button" className="cp-cargar-btn" onClick={() => inputEticaRef.current?.click()}>
            <Upload size={14} />
            {formatoEtica ? formatoEtica.name : 'Cargar'}
          </button>
          <input
            ref={inputEticaRef}
            type="file"
            className="cp-file-input"
            onChange={(e) => setFormatoEtica(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <p className="cp-hint-text">Adicionar los formatos vigentes para la convocatoria</p>
    </div>
  )
}

// ---------- Subcomponentes reutilizables ----------

interface RadioOptionProps {
  name: string
  label: string
  checked?: boolean
  onChange?: () => void
}

function RadioOption({ name, label, checked, onChange }: RadioOptionProps) {
  return (
    <label className="cp-radio-option">
      <span>{label}</span>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
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

interface TextareaConContadorProps {
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder?: string
}

function TextareaConContador({ value, onChange, maxLength, placeholder }: TextareaConContadorProps) {
  return (
    <div className="cp-textarea-wrapper">
      <textarea
        className="cp-textarea"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="cp-char-count">
        {value.length}/{maxLength}
      </span>
    </div>
  )
}

export default CrearProyecto