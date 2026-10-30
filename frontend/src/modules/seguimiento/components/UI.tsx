import { useState, type ReactNode } from 'react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { ApiError } from '../../../shared/api/client'
import * as codigoFirmaApi from '../../../shared/api/codigoFirma'
import type { FirmaSeguimiento } from '../api/tipos'
import { formatoFecha } from '../lib/formato'
import { siguienteFirma } from '../lib/reglas'

type ColorBadge = 'gris' | 'amarillo' | 'verde' | 'azul' | 'rojo'

const COLOR_POR_ESTADO: Record<string, ColorBadge> = {
  Aprobada: 'verde',
  Aprobado: 'verde',
  Finalizado: 'verde',
  Cumple: 'verde',
  Cumplida: 'verde',
  Pendiente: 'amarillo',
  'En seguimiento': 'amarillo',
  Devuelto: 'amarillo',
  Parcial: 'amarillo',
  'Cumple con observaciones': 'amarillo',
  Radicado: 'azul',
  Devuelta: 'azul',
  'En ejecución': 'azul',
  'Informe final radicado': 'azul',
  Rechazada: 'rojo',
  Cancelado: 'rojo',
  'No cumple': 'rojo',
  Bajo: 'rojo',
  Aplazada: 'rojo',
}

export function Badge({ estado }: { estado: string }) {
  return <span className={`seg-badge seg-badge-${COLOR_POR_ESTADO[estado] ?? 'gris'}`}>{estado}</span>
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'info' | 'ok'; children: ReactNode }) {
  return <div className={`seg-aviso seg-aviso-${tipo}`}>{children}</div>
}

export function Pestanas<T extends string>({
  opciones,
  activa,
  onCambiar,
}: {
  opciones: { valor: T; etiqueta: string }[]
  activa: T
  onCambiar: (valor: T) => void
}) {
  return (
    <div className="seg-tabs" role="tablist">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={o.valor === activa}
          className={`seg-tab ${o.valor === activa ? 'seg-tab-activa' : ''}`}
          onClick={() => onCambiar(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

export function Kpi({ etiqueta, valor, color }: { etiqueta: string; valor: ReactNode; color?: string }) {
  return (
    <div className="seg-kpi">
      <div className="seg-kpi-label">{etiqueta}</div>
      <div className="seg-kpi-valor" style={color ? { color } : undefined}>{valor}</div>
    </div>
  )
}

export function CampoLectura({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <label className="seg-campo">
      {etiqueta}
      <input disabled value={String(valor ?? '')} />
    </label>
  )
}

export function Encabezado({ titulo, miga, children }: { titulo: string; miga: string; children?: ReactNode }) {
  return (
    <div className="seg-card seg-header">
      <span className="seg-miga">{miga}</span>
      <div className="seg-header-fila">
        <h2>{titulo}</h2>
      </div>
      {children}
    </div>
  )
}

/** Última fila de la lista de firmas de un informe: la firma del Administrador como quien lo revisó, que se da al aprobarlo. */
export function FilaRevisadoPor({
  revisado,
  radicado,
  numero,
}: {
  revisado?: { nombre: string; fecha: string } | null
  radicado: boolean
  numero: number
}) {
  return (
    <li>
      <span className={`seg-firma-num ${revisado ? 'seg-firma-num-ok' : ''}`}>{revisado ? '✓' : numero}</span>
      <span className="seg-firma-texto">
        <span className="seg-firma-rol">Revisado por (Administrador)</span>
        <span className="seg-firma-estado">
          {revisado
            ? `${revisado.nombre} · Firmado ${formatoFecha(revisado.fecha)}`
            : radicado
              ? 'En revisión: se firma al aprobar el informe'
              : 'Se firma al aprobar el informe, después de radicarlo'}
        </span>
      </span>
    </li>
  )
}

/** Firmas que se hacen con el código de verificación enviado al correo personal de quien firma (la del Administrador, que firma al final, no). */
const ROLES_CON_CODIGO: FirmaSeguimiento['rol'][] = ['Investigador principal', 'Co-investigadores', 'Líder del grupo', 'Vicerrector']

/** Lista de firmas en orden: cada firma se habilita cuando firmó la anterior,
 * y solo para quien tenga el rol correspondiente. */
export function FirmasSecuenciales({
  firmas,
  habilitado,
  puedeFirmar,
  onFirmar,
  textoConfirmacion,
  extras,
  idProyecto,
  documento,
}: {
  firmas: FirmaSeguimiento[]
  habilitado: boolean
  puedeFirmar: (f: FirmaSeguimiento) => boolean
  onFirmar: (indice: number) => void
  textoConfirmacion: string
  /** Filas adicionales al final de la lista (p. ej. el "revisado por" del Administrador). */
  extras?: ReactNode
  /** Con el proyecto, la firma de los investigadores pide un código de verificación que llega a su correo personal. */
  idProyecto?: number
  /** Nombre del documento que se firma, para el correo del código ("informe de avance 2"). */
  documento?: string
}) {
  const [confirmar, setConfirmar] = useState<number | null>(null)
  const turno = siguienteFirma(firmas)
  // Código de verificación: lo piden las firmas de los investigadores (la del Vicerrector y la del Administrador, no).
  const [codigo, setCodigo] = useState('')
  const [codigoEnviado, setCodigoEnviado] = useState(false)
  const [ocupadoCodigo, setOcupadoCodigo] = useState(false)
  const [avisoCodigo, setAvisoCodigo] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const pideCodigo = (f: FirmaSeguimiento) => idProyecto !== undefined && ROLES_CON_CODIGO.includes(f.rol)

  const abrirFirma = (i: number) => {
    setCodigo('')
    setCodigoEnviado(false)
    setAvisoCodigo(null)
    setConfirmar(i)
  }
  const cerrarFirma = () => {
    setConfirmar(null)
    setCodigo('')
    setCodigoEnviado(false)
    setAvisoCodigo(null)
  }
  const mensajeDe = (err: unknown, defecto: string) => (err instanceof ApiError ? err.message : defecto)

  const enviarCodigo = async () => {
    if (idProyecto === undefined) return
    setOcupadoCodigo(true)
    setAvisoCodigo(null)
    try {
      const r = await codigoFirmaApi.solicitarCodigoFirma(idProyecto, documento ?? 'documento de seguimiento')
      setCodigoEnviado(true)
      setCodigo('')
      setAvisoCodigo({ tipo: 'ok', texto: `Te enviamos un código de 6 dígitos a ${r.correo_enmascarado}. Vence en ${r.vence_en_minutos} minutos.` })
    } catch (err) {
      setAvisoCodigo({ tipo: 'error', texto: mensajeDe(err, 'No se pudo enviar el código. Intenta de nuevo.') })
    } finally {
      setOcupadoCodigo(false)
    }
  }

  const firmarConCodigo = async () => {
    if (idProyecto === undefined || confirmar === null) return
    setOcupadoCodigo(true)
    setAvisoCodigo(null)
    try {
      await codigoFirmaApi.verificarCodigoFirma(idProyecto, codigo)
      const i = confirmar
      cerrarFirma()
      onFirmar(i)
    } catch (err) {
      setAvisoCodigo({ tipo: 'error', texto: mensajeDe(err, 'No se pudo verificar el código. Intenta de nuevo.') })
    } finally {
      setOcupadoCodigo(false)
    }
  }

  return (
    <>
      <ul className="seg-firmas">
        {firmas.map((f, i) => {
          const esTurno = i === turno && habilitado
          return (
            <li key={f.rol}>
              <span className={`seg-firma-num ${f.firmado ? 'seg-firma-num-ok' : esTurno ? 'seg-firma-num-turno' : ''}`}>
                {f.firmado ? '✓' : i + 1}
              </span>
              <span className="seg-firma-texto">
                <span className="seg-firma-rol">{f.rol === 'Administrador' ? 'Administrador (elaborado por)' : f.rol}</span>
                <span className="seg-firma-estado">
                  {f.firmado
                    ? `Firmado · ${formatoFecha(f.fecha)}`
                    : i === turno
                      ? 'Pendiente de firma'
                      : 'Se habilita al completar las firmas anteriores'}
                </span>
              </span>
              {!f.firmado && esTurno && puedeFirmar(f) && (
                <button type="button" className="seg-btn seg-btn-sm" onClick={() => abrirFirma(i)}>
                  Firmar
                </button>
              )}
            </li>
          )
        })}
        {extras}
      </ul>

      {confirmar !== null && pideCodigo(firmas[confirmar]) && (
        <div className="seg-codigo">
          <p>
            {textoConfirmacion} Firmas como: <b>{firmas[confirmar].rol}</b>.
          </p>
          <p className="seg-codigo-nota">Para firmar te enviamos un código de verificación de 6 dígitos a tu correo personal.</p>
          <div className="seg-acciones">
            <button type="button" className="seg-btn seg-btn-sec" disabled={ocupadoCodigo} onClick={enviarCodigo}>
              {codigoEnviado ? 'Reenviar código' : 'Enviar código a mi correo personal'}
            </button>
            <button type="button" className="seg-btn seg-btn-borde" disabled={ocupadoCodigo} onClick={cerrarFirma}>
              Cancelar
            </button>
          </div>
          {codigoEnviado && (
            <div className="seg-codigo-campo">
              <label>
                Código de verificación
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  aria-label="Código de verificación"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </label>
              <button type="button" className="seg-btn" disabled={ocupadoCodigo || codigo.length !== 6} onClick={firmarConCodigo}>
                Firmar
              </button>
            </div>
          )}
          {avisoCodigo && <Aviso tipo={avisoCodigo.tipo}>{avisoCodigo.texto}</Aviso>}
        </div>
      )}

      {confirmar !== null && !pideCodigo(firmas[confirmar]) && (
        <ConfirmModal
          mensaje={`${textoConfirmacion} Firmas como: ${firmas[confirmar].rol}.`}
          onClose={() => setConfirmar(null)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmar(null), variante: 'rojo' }}
          botonPrimario={{
            label: 'Firmar',
            variante: 'azul',
            onClick: () => {
              const i = confirmar
              setConfirmar(null)
              onFirmar(i)
            },
          }}
        />
      )}
    </>
  )
}
