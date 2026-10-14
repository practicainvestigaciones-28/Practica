import { useEffect, useState } from 'react'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as gruposApi from '../api/grupos'
import SelectorUnidad, { type UnidadSeleccionada } from '../../catalogos/components/SelectorUnidad'
import { ApiError } from '../../../shared/api/client'
import './GrupoInformacionGeneralForm.css'

interface GrupoInformacionGeneralFormProps {
  grupo: gruposApi.GrupoInvestigacionItem
  /** true = puede reasignar el líder del grupo (solo Administrador). */
  esAdmin: boolean
  onGuardado: (registro: gruposApi.GrupoInvestigacionItem) => void
  onCancelar?: () => void
}

function datosIniciales(grupo: gruposApi.GrupoInvestigacionItem) {
  return {
    unidad: grupo.id_departamento
      ? { tipo: 'departamento' as const, id: grupo.id_departamento }
      : { tipo: 'facultad' as const, id: grupo.id_facultad },
    idPrograma: grupo.id_programa,
    liderGrupo: grupo.lider_grupo ?? '',
    codGruplac: grupo.cod_gruplac ?? '',
    reconocidoMinciencias: grupo.reconocido_minciencias,
    categoria: grupo.categoria ?? '',
    acuerdoInstitucional: grupo.acuerdo_institucional ?? '',
    idLider: grupo.id_lider,
  }
}

/**
 * Información general de un grupo de investigación: la administra el
 * Administrador o el líder asignado a ESE grupo (ver id_lider). Se usa tanto
 * en el catálogo de Administrador (ConfigurarOpcionesConvocatoria) como en la
 * vista de autogestión del líder (SeguimientoProyectos).
 */
function GrupoInformacionGeneralForm({ grupo, esAdmin, onGuardado, onCancelar }: GrupoInformacionGeneralFormProps) {
  const [facultades, setFacultades] = useState<catalogosApi.FacultadItem[]>([])
  const [departamentos, setDepartamentos] = useState<catalogosApi.DepartamentoItem[]>([])
  const [programas, setProgramas] = useState<catalogosApi.ProgramaItem[]>([])
  const [lideres, setLideres] = useState<gruposApi.LiderDisponible[]>([])

  const inicial = datosIniciales(grupo)
  const [tipoPrograma, setTipoPrograma] = useState<'pregrado' | 'posgrado' | null>(null)
  const [unidad, setUnidad] = useState<UnidadSeleccionada>(inicial.unidad)
  const [idPrograma, setIdPrograma] = useState<number | null>(inicial.idPrograma)
  const [liderGrupo, setLiderGrupo] = useState(inicial.liderGrupo)
  const [codGruplac, setCodGruplac] = useState(inicial.codGruplac)
  const [reconocidoMinciencias, setReconocidoMinciencias] = useState(inicial.reconocidoMinciencias)
  const [categoria, setCategoria] = useState(inicial.categoria)
  const [acuerdoInstitucional, setAcuerdoInstitucional] = useState(inicial.acuerdoInstitucional)
  const [idLider, setIdLider] = useState<number | null>(inicial.idLider)

  // El Administrador llega aquí desde un botón que ya significa "editar", así
  // que entra directo en modo edición. El líder, en cambio, entra a "Mi grupo
  // de investigación" solo a CONSULTAR la información — debe pedir editar
  // explícitamente antes de que los campos se habiliten.
  const [editando, setEditando] = useState(esAdmin)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    catalogosApi.listarFacultades(true).then(setFacultades).catch(() => setFacultades([]))
    catalogosApi.listarDepartamentos(true).then(setDepartamentos).catch(() => setDepartamentos([]))
    catalogosApi.listarProgramas(true).then(setProgramas).catch(() => setProgramas([]))
    if (esAdmin) {
      gruposApi.listarLideresDisponibles().then(setLideres).catch(() => setLideres([]))
    }
  }, [esAdmin])

  // Si el grupo ya tenía un programa guardado, una vez cargue el catálogo se
  // infiere su nivel (pregrado/posgrado) para que el filtro arranque mostrando
  // ese programa en vez de aparecer vacío.
  useEffect(() => {
    if (idPrograma && !tipoPrograma) {
      const actual = programas.find((p) => p.id_programa === idPrograma)
      if (actual?.tipoPrograma?.nombre === 'pregrado' || actual?.tipoPrograma?.nombre === 'posgrado') {
        setTipoPrograma(actual.tipoPrograma.nombre)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programas])

  const programasFiltrados = programas
    .filter((p) => !unidad.id || (unidad.tipo === 'facultad' ? p.id_facultad === unidad.id : p.id_departamento === unidad.id))
    .filter((p) => !tipoPrograma || p.tipoPrograma?.nombre === tipoPrograma)

  // Mientras haya una cuenta de usuario asignada como líder (id_lider), el
  // nombre que se imprime en el formato se deriva de ESA cuenta — ya no se
  // escribe aparte a mano, para que no quede un nombre distinto al de quien
  // realmente administra el grupo (pasaba con TECNOFILIA: el campo de texto
  // decía "Jorge Albeiro Rivera Rosero" pero la cuenta vinculada era otra
  // persona). Si no hay cuenta vinculada, el texto manual se conserva tal
  // cual — sirve para un líder real que todavía no tiene usuario en el sistema.
  const liderVinculado = idLider != null ? lideres.find((l) => l.id_usuario === idLider) : undefined
  const nombreLiderImpreso = liderVinculado ? `${liderVinculado.nombre} ${liderVinculado.apellido}`.trim() : liderGrupo

  const handleActivarEdicion = () => setEditando(true)

  const handleCancelar = () => {
    const d = datosIniciales(grupo)
    const actual = d.idPrograma ? programas.find((p) => p.id_programa === d.idPrograma) : undefined
    setTipoPrograma(actual?.tipoPrograma?.nombre === 'posgrado' ? 'posgrado' : actual?.tipoPrograma?.nombre === 'pregrado' ? 'pregrado' : null)
    setUnidad(d.unidad)
    setIdPrograma(d.idPrograma)
    setLiderGrupo(d.liderGrupo)
    setCodGruplac(d.codGruplac)
    setReconocidoMinciencias(d.reconocidoMinciencias)
    setCategoria(d.categoria)
    setAcuerdoInstitucional(d.acuerdoInstitucional)
    setIdLider(d.idLider)
    setError('')
    if (!esAdmin) setEditando(false)
    onCancelar?.()
  }

  const handleGuardar = () => {
    setGuardando(true)
    setError('')
    gruposApi
      .actualizarGrupo(grupo.id_grupo, {
        id_facultad: unidad.tipo === 'facultad' ? unidad.id : null,
        id_departamento: unidad.tipo === 'departamento' ? unidad.id : null,
        id_programa: idPrograma ?? undefined,
        ...(esAdmin ? { lider_grupo: nombreLiderImpreso.trim() || undefined } : {}),
        cod_gruplac: codGruplac.trim() || undefined,
        reconocido_minciencias: reconocidoMinciencias,
        categoria: categoria.trim() || undefined,
        acuerdo_institucional: acuerdoInstitucional.trim() || undefined,
        ...(esAdmin ? { id_lider: idLider } : {}),
      })
      .then((res) => {
        onGuardado(res.registro)
        if (!esAdmin) setEditando(false)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la información del grupo.'))
      .finally(() => setGuardando(false))
  }

  const bloqueado = !editando

  return (
    <div className="gig-form">
      <div className="gig-campo">
        <label>Pregrado o Posgrado:</label>
        <select
          value={tipoPrograma ?? ''}
          disabled={bloqueado}
          onChange={(e) => {
            setTipoPrograma(e.target.value ? (e.target.value as 'pregrado' | 'posgrado') : null)
            setIdPrograma(null)
          }}
        >
          <option value="">Selecciona pregrado o posgrado</option>
          <option value="pregrado">Pregrado</option>
          <option value="posgrado">Posgrado</option>
        </select>
      </div>

      <div className="gig-campo">
        <label>Facultad/Departamento:</label>
        {bloqueado ? (
          <input type="text" value={unidad.tipo === 'facultad' ? facultades.find((f) => f.id_facultad === unidad.id)?.nombre ?? '' : departamentos.find((d) => d.id_departamento === unidad.id)?.nombre ?? ''} readOnly />
        ) : (
          <SelectorUnidad
            unidad={unidad}
            onChange={(u) => {
              setUnidad(u)
              setIdPrograma(null)
            }}
            facultades={facultades.map((f) => ({ id: f.id_facultad, nombre: f.nombre }))}
            departamentos={departamentos.map((d) => ({ id: d.id_departamento, nombre: d.nombre }))}
          />
        )}
      </div>

      <div className="gig-campo">
        <label>Programa académico:</label>
        <select
          value={idPrograma ?? ''}
          onChange={(e) => setIdPrograma(e.target.value ? Number(e.target.value) : null)}
          disabled={bloqueado || !unidad.id || !tipoPrograma}
        >
          <option value="">
            {!tipoPrograma ? 'Primero elige pregrado o posgrado' : !unidad.id ? 'Primero elige facultad o departamento' : 'Selecciona un programa'}
          </option>
          {programasFiltrados.map((p) => (
            <option key={p.id_programa} value={p.id_programa}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="gig-campo">
        <label>Líder del grupo (nombre para el formato):</label>
        <input
          type="text"
          value={nombreLiderImpreso}
          onChange={liderVinculado ? undefined : (e) => setLiderGrupo(e.target.value)}
          readOnly={bloqueado || Boolean(liderVinculado)}
          title={liderVinculado ? 'Se completa automáticamente con el usuario líder asignado' : undefined}
        />
      </div>

      {esAdmin && (
        <div className="gig-campo">
          <label>Usuario líder (administra esta información):</label>
          <select value={idLider ?? ''} disabled={bloqueado} onChange={(e) => setIdLider(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Sin asignar (solo el Administrador puede editar)</option>
            {lideres.map((l) => (
              <option key={l.id_usuario} value={l.id_usuario}>
                {l.nombre} {l.apellido} — {l.correo}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="gig-campo">
        <label>Código GrupLAC:</label>
        <input type="text" value={codGruplac} onChange={(e) => setCodGruplac(e.target.value)} readOnly={bloqueado} />
      </div>

      <div className="gig-campo gig-campo-checkbox">
        <label>
          <input
            type="checkbox"
            checked={reconocidoMinciencias}
            onChange={(e) => setReconocidoMinciencias(e.target.checked)}
            disabled={bloqueado}
          />
          Reconocido por MINCIENCIAS
        </label>
      </div>

      <div className="gig-campo">
        <label>Categoría:</label>
        <input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)} readOnly={bloqueado} />
      </div>

      <div className="gig-campo">
        <label>Acuerdo institucional:</label>
        <input type="text" value={acuerdoInstitucional} onChange={(e) => setAcuerdoInstitucional(e.target.value)} readOnly={bloqueado} />
      </div>

      {error && <p className="gig-error">{error}</p>}

      <div className="gig-acciones">
        {!esAdmin && !editando ? (
          <button type="button" className="gig-btn-guardar" onClick={handleActivarEdicion}>
            Editar
          </button>
        ) : (
          <>
            {(onCancelar || !esAdmin) && (
              <button type="button" className="gig-btn-cancelar" onClick={handleCancelar} disabled={guardando}>
                Cancelar
              </button>
            )}
            <button type="button" className="gig-btn-guardar" onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default GrupoInformacionGeneralForm
