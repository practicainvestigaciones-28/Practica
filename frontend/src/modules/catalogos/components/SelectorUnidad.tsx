import './SelectorUnidad.css'

/** Facultad y Departamento son catálogos separados, pero un Programa/Grupo pertenece a exactamente uno de los dos. */
export interface UnidadSeleccionada {
  tipo: 'facultad' | 'departamento'
  id: number | null
}

export const UNIDAD_VACIA: UnidadSeleccionada = { tipo: 'facultad', id: null }

export type DatosUnidad = { id_facultad: number; id_departamento?: never } | { id_facultad?: never; id_departamento: number }

export function datosUnidad(u: UnidadSeleccionada): DatosUnidad | undefined {
  if (!u.id) return undefined
  return u.tipo === 'facultad' ? { id_facultad: u.id } : { id_departamento: u.id }
}

interface OpcionUnidad {
  id: number
  nombre: string
}

/** Switch Facultad/Departamento + el desplegable de esa unidad (son catálogos separados, uno u otro). */
function SelectorUnidad({
  unidad,
  onChange,
  facultades,
  departamentos,
}: {
  unidad: UnidadSeleccionada
  onChange: (u: UnidadSeleccionada) => void
  facultades: OpcionUnidad[]
  departamentos: OpcionUnidad[]
}) {
  const opciones = unidad.tipo === 'facultad' ? facultades : departamentos
  return (
    <>
      <div className="su-subtabs">
        <button
          type="button"
          className={`su-subtab ${unidad.tipo === 'facultad' ? 'su-subtab-active' : ''}`}
          onClick={() => onChange({ tipo: 'facultad', id: null })}
        >
          Facultad
        </button>
        <button
          type="button"
          className={`su-subtab ${unidad.tipo === 'departamento' ? 'su-subtab-active' : ''}`}
          onClick={() => onChange({ tipo: 'departamento', id: null })}
        >
          Departamento
        </button>
      </div>
      <select value={unidad.id ?? ''} onChange={(e) => onChange({ ...unidad, id: e.target.value ? Number(e.target.value) : null })}>
        <option value="">{unidad.tipo === 'facultad' ? 'Selecciona facultad' : 'Selecciona departamento'}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
    </>
  )
}

export default SelectorUnidad
