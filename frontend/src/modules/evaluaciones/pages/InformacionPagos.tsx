import { useEffect, useState } from 'react'
import { Pencil, Save, X as XIcon } from 'lucide-react'
import { useAuth } from '../../auth/context/AuthContext'
import { cargarProyectosAsignados } from '../lib/bandejaEvaluacion'
import * as pagosApi from '../api/pagos'
import { ApiError } from '../../../shared/api/client'
import './InformacionPagos.css'

const nombreTipoCuenta = (tipo: string) => (tipo === 'corriente' ? 'Corriente' : 'Ahorros')

function InformacionPagos() {
  const { usuario } = useAuth()
  const [cantidadEvaluaciones, setCantidadEvaluaciones] = useState(0)
  const [cargando, setCargando] = useState(true)

  const [datosBancarios, setDatosBancarios] = useState<pagosApi.DatosBancarios | null>(null)
  const [editando, setEditando] = useState(false)
  const [banco, setBanco] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('ahorros')
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarProyectosAsignados()
      .then((proyectos) => setCantidadEvaluaciones(proyectos.filter((p) => p.resultadoFinal !== null).length))
      .catch(() => setCantidadEvaluaciones(0))

    pagosApi
      .obtenerMisDatosBancarios()
      .then(({ datos }) => setDatosBancarios(datos))
      .catch(() => setDatosBancarios(null))
      .finally(() => setCargando(false))
  }, [])

  const iniciarEdicion = () => {
    setBanco(datosBancarios?.banco ?? '')
    setTipoCuenta(datosBancarios?.tipo_cuenta ?? 'ahorros')
    setNumeroCuenta(datosBancarios?.numero_cuenta ?? '')
    setError('')
    setEditando(true)
  }

  const cancelarEdicion = () => {
    setEditando(false)
    setError('')
  }

  const guardar = () => {
    if (!banco.trim() || !numeroCuenta.trim()) {
      setError('Completa el banco y el número de cuenta.')
      return
    }
    setError('')
    setGuardando(true)
    pagosApi
      .guardarMisDatosBancarios({
        banco: banco.trim(),
        tipo_cuenta: tipoCuenta,
        numero_cuenta: numeroCuenta.trim(),
        titular: usuario ? `${usuario.nombre} ${usuario.apellido}` : '',
        documento_titular: usuario?.cedula ?? '',
      })
      .then(({ datos }) => {
        setDatosBancarios(datos)
        setEditando(false)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos bancarios.'))
      .finally(() => setGuardando(false))
  }

  return (
    <div className="pagos-page">
      <div className="pagos-header-card">
        <h2>Información de pagos</h2>
        <p>Datos bancarios y valor a pagar por las evaluaciones realizadas</p>
      </div>

      {error && <p className="pagos-error">{error}</p>}

      <div className="pagos-tabla-wrapper">
        <table className="pagos-tabla">
          <thead>
            <tr>
              <th>No.</th>
              <th>Pares Evaluadores</th>
              <th>No. Cédula</th>
              <th>Cantidad de Evaluaciones</th>
              <th>Tipo de cuenta</th>
              <th>No. Cuenta</th>
              <th>Banco</th>
              <th>Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <span className="pagos-nombre">{usuario ? `${usuario.nombre} ${usuario.apellido}` : '—'}</span>
                <span className="pagos-correo">{usuario?.correo ?? '—'}</span>
              </td>
              <td>{usuario?.cedula ?? '—'}</td>
              <td className="pagos-cantidad">{cargando ? '—' : cantidadEvaluaciones}</td>

              {editando ? (
                <>
                  <td>
                    <select className="pagos-input" value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value)}>
                      <option value="ahorros">Ahorros</option>
                      <option value="corriente">Corriente</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="pagos-input"
                      value={numeroCuenta}
                      onChange={(e) => setNumeroCuenta(e.target.value)}
                      placeholder="No. Cuenta"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="pagos-input"
                      value={banco}
                      onChange={(e) => setBanco(e.target.value)}
                      placeholder="Banco"
                    />
                  </td>
                  <td className="pagos-pendiente">Sin registrar</td>
                  <td className="pagos-acciones">
                    <button type="button" className="pagos-btn-guardar" onClick={guardar} disabled={guardando} aria-label="Guardar">
                      <Save size={14} />
                    </button>
                    <button type="button" className="pagos-btn-cancelar" onClick={cancelarEdicion} disabled={guardando} aria-label="Cancelar">
                      <XIcon size={14} />
                    </button>
                  </td>
                </>
              ) : (
                <>
                  {datosBancarios ? (
                    <>
                      <td>{nombreTipoCuenta(datosBancarios.tipo_cuenta)}</td>
                      <td>{datosBancarios.numero_cuenta}</td>
                      <td>{datosBancarios.banco}</td>
                    </>
                  ) : (
                    <>
                      <td className="pagos-pendiente">Sin registrar</td>
                      <td className="pagos-pendiente">Sin registrar</td>
                      <td className="pagos-pendiente">Sin registrar</td>
                    </>
                  )}
                  <td className="pagos-pendiente">Sin registrar</td>
                  <td className="pagos-acciones">
                    <button type="button" className="pagos-btn-editar" onClick={iniciarEdicion} aria-label="Editar datos bancarios">
                      <Pencil size={14} />
                    </button>
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default InformacionPagos
