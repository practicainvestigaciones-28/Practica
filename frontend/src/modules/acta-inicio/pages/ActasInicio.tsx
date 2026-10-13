import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Search } from 'lucide-react'
import * as actaApi from '../api/actaInicio'
import { ETIQUETA_ESTADO_ACTA } from '../lib/actaInicio'
import { ApiError } from '../../../shared/api/client'
import { getRole, getRolesEfectivos, type Role } from '../../auth/lib/auth'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import './ActaInicio.css'

const DESCRIPCION_POR_ROL: Partial<Record<Role, string>> = {
  administrador: 'Proyectos aprobados pendientes de legalización o ya en ejecución (formato INV-IC-FR-017).',
  usuario: 'Actas de inicio de tus proyectos aprobados: completa tus datos, acepta los compromisos y firma.',
  vicerrector: 'Actas de inicio que esperan tu firma para autorizar el arranque del proyecto.',
}

function ActasInicio() {
  const navigate = useNavigate()
  const [filas, setFilas] = useState<actaApi.ActaInicioResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const esAdmin = getRolesEfectivos().includes('administrador')

  const cargar = () => {
    actaApi
      .listarActasInicio()
      .then(setFilas)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de actas de inicio.'))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const filtradas = useMemo(
    () => filas.filter((f) => `${f.titulo} ${f.investigador_principal ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())),
    [filas, busqueda]
  )

  return (
    <div className="acta-page">
      <div className="acta-card">
        <h2>Actas de inicio {actaApi.MODO_PRUEBA && <span className="acta-modo-prueba">Modo prueba</span>}</h2>
        <p>{DESCRIPCION_POR_ROL[getRole()] ?? DESCRIPCION_POR_ROL.usuario}</p>
      </div>

      <div className="acta-barra">
        <div className="acta-search">
          <Search size={16} />
          <input placeholder="Busca por título o investigador" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        {actaApi.MODO_PRUEBA && esAdmin && (
          <button type="button" className="acta-btn acta-btn-borde" onClick={() => setConfirmarReinicio(true)}>
            <RotateCcw size={14} /> Reiniciar datos de prueba
          </button>
        )}
      </div>
      {esAdmin && (
        <p className="acta-nota">
          Los datos del acta se ingresan en los proyectos “Sin iniciar” o “En elaboración”. Las actas en firma o legalizadas quedan de solo lectura.
        </p>
      )}

      {error && <p className="acta-error">{error}</p>}
      {cargando ? (
        <p className="acta-vacio">Cargando...</p>
      ) : filtradas.length === 0 ? (
        <p className="acta-vacio">No hay proyectos para mostrar.</p>
      ) : (
        <div className="acta-card acta-tabla-wrap">
          <table className="acta-tabla">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Investigador principal</th>
                <th>Convocatoria</th>
                <th>Estado del proyecto</th>
                <th>Acta de inicio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => (
                <tr key={f.id_proyecto}>
                  <td>{f.titulo}</td>
                  <td>{f.investigador_principal ?? '—'}</td>
                  <td>{f.convocatoria ?? '—'}</td>
                  <td>{f.estado_proyecto}</td>
                  <td>
                    <span className={`acta-badge acta-badge-${(f.estado_acta ?? 'sin_acta').replace(' ', '-')}`}>
                      {ETIQUETA_ESTADO_ACTA[f.estado_acta ?? 'sin_acta']}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="acta-btn" onClick={() => navigate(`/acta-inicio/${f.id_proyecto}`)}>
                      {esAdmin && (f.estado_acta === null || f.estado_acta === 'en elaboracion') ? 'Diligenciar' : 'Abrir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmarReinicio && (
        <ConfirmModal
          mensaje="¿Reiniciar las actas de inicio de prueba? Se pierde lo registrado en este navegador y vuelven los proyectos de ejemplo."
          onClose={() => setConfirmarReinicio(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarReinicio(false), variante: 'azul' }}
          botonPrimario={{
            label: 'Reiniciar',
            variante: 'rojo',
            onClick: () => {
              setConfirmarReinicio(false)
              actaApi.reiniciarDatosPrueba().then(cargar)
            },
          }}
        />
      )}
    </div>
  )
}

export default ActasInicio
