import { useState, type ReactNode } from 'react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
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
        <span className="seg-modo-prueba" title="Los datos se guardan en este navegador hasta que el backend exponga /api/seguimiento.">
          Modo prueba
        </span>
      </div>
      {children}
    </div>
  )
}

/** Lista de firmas en orden: cada firma se habilita cuando firmó la anterior,
 * y solo para quien tenga el rol correspondiente. */
export function FirmasSecuenciales({
  firmas,
  habilitado,
  puedeFirmar,
  onFirmar,
  textoConfirmacion,
  nota,
}: {
  firmas: FirmaSeguimiento[]
  habilitado: boolean
  puedeFirmar: (f: FirmaSeguimiento) => boolean
  onFirmar: (indice: number) => void
  textoConfirmacion: string
  /** Aclaración que se muestra bajo la lista (por ejemplo, quién puede firmar en modo prueba). */
  nota?: string
}) {
  const [confirmar, setConfirmar] = useState<number | null>(null)
  const turno = siguienteFirma(firmas)

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
                <span className="seg-firma-rol">{f.rol}</span>
                <span className="seg-firma-estado">
                  {f.firmado
                    ? `Firmado · ${formatoFecha(f.fecha)}`
                    : i === turno
                      ? 'Pendiente de firma'
                      : 'Se habilita al completar las firmas anteriores'}
                </span>
              </span>
              {!f.firmado && esTurno && puedeFirmar(f) && (
                <button type="button" className="seg-btn seg-btn-sm" onClick={() => setConfirmar(i)}>
                  Firmar
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {nota && <p className="seg-ayuda" style={{ marginTop: 8 }}>{nota}</p>}

      {confirmar !== null && (
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
