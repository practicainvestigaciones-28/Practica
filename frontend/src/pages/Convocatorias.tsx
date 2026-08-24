import { useState } from 'react'
import { FilePlus, Search, SquarePen } from 'lucide-react'
import {
  getConvocatorias,
  addConvocatoria,
  toggleConvocatoria,
  type Convocatoria,
} from '../lib/convocatorias'
import './Convocatorias.css'

type Tab = 'convocatorias' | 'periodos'

function Convocatorias() {
  const [tab, setTab] = useState<Tab>('convocatorias')
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>(getConvocatorias())
  const [busqueda, setBusqueda] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [mostrandoForm, setMostrandoForm] = useState(false)

  const refrescar = () => setConvocatorias([...getConvocatorias()])

  const handleAgregar = () => {
    if (!nuevoNombre.trim()) return
    addConvocatoria(nuevoNombre.trim())
    setNuevoNombre('')
    setMostrandoForm(false)
    refrescar()
  }

  const handleToggle = (id: number) => {
    toggleConvocatoria(id)
    refrescar()
  }

  const filtradas = convocatorias.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="conv-page">
      <div className="conv-tabs">
        <button
          type="button"
          className={`conv-tab ${tab === 'convocatorias' ? 'conv-tab-active' : ''}`}
          onClick={() => setTab('convocatorias')}
        >
          Convocatorias
        </button>
        <button
          type="button"
          className={`conv-tab ${tab === 'periodos' ? 'conv-tab-active' : ''}`}
          onClick={() => setTab('periodos')}
        >
          Periódos
        </button>
      </div>

      {tab === 'convocatorias' ? (
        <>
          <div className="conv-toolbar">
            <button
              type="button"
              className="conv-add-btn"
              onClick={() => setMostrandoForm(!mostrandoForm)}
            >
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

          {mostrandoForm && (
            <div className="conv-add-form">
              <input
                type="text"
                placeholder="Nombre de la convocatoria"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                autoFocus
              />
              <button type="button" className="conv-add-confirm" onClick={handleAgregar}>
                Guardar
              </button>
            </div>
          )}

          <div className="conv-list">
            {filtradas.map((c) => (
              <div className="conv-card" key={c.id}>
                <span className="conv-card-nombre">{c.nombre}</span>

                <div className="conv-card-proyectos">
                  <span className="conv-card-proyectos-label">Proyectos</span>
                  <span className="conv-card-proyectos-badge">{c.proyectos}</span>
                </div>

                <button type="button" className="conv-edit-btn" aria-label="Editar convocatoria">
                  <SquarePen size={16} />
                </button>

                <label className="conv-switch">
                  <input
                    type="checkbox"
                    checked={c.activa}
                    onChange={() => handleToggle(c.id)}
                  />
                  <span className="conv-switch-slider" />
                </label>
              </div>
            ))}

            {filtradas.length === 0 && (
              <p className="conv-empty">No se encontraron convocatorias.</p>
            )}
          </div>
        </>
      ) : (
        <div className="placeholder-page">
          <h2>Periódos — próximamente</h2>
        </div>
      )}
    </div>
  )
}

export default Convocatorias