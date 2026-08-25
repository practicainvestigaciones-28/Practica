import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import './DateRangeCalendar.css'

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]
const DIAS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DiaCalendario {
  fecha: Date
  delMesActual: boolean
}

function generarDias(anio: number, mes: number): DiaCalendario[] {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)

  const dias: DiaCalendario[] = []

  // Días del mes anterior para completar la primera semana
  const diaSemanaInicio = primerDia.getDay()
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    dias.push({ fecha: new Date(anio, mes, -i), delMesActual: false })
  }

  // Días del mes actual
  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    dias.push({ fecha: new Date(anio, mes, d), delMesActual: true })
  }

  // Días del mes siguiente para completar la última semana
  const restante = 7 - (dias.length % 7)
  if (restante < 7) {
    for (let d = 1; d <= restante; d++) {
      dias.push({ fecha: new Date(anio, mes + 1, d), delMesActual: false })
    }
  }

  return dias
}

function mismodia(a: Date, b: Date | null) {
  if (!b) return false
  return a.toDateString() === b.toDateString()
}

interface DateRangeCalendarProps {
  inicio: Date | null
  fin: Date | null
  onChange: (inicio: Date | null, fin: Date | null) => void
}

function DateRangeCalendar({ inicio, fin, onChange }: DateRangeCalendarProps) {
  const hoy = new Date()
  const [mesVisible, setMesVisible] = useState(inicio?.getMonth() ?? hoy.getMonth())
  const [anioVisible, setAnioVisible] = useState(inicio?.getFullYear() ?? hoy.getFullYear())

  const dias = generarDias(anioVisible, mesVisible)

  const cambiarMes = (delta: number) => {
    let nuevoMes = mesVisible + delta
    let nuevoAnio = anioVisible
    if (nuevoMes < 0) {
      nuevoMes = 11
      nuevoAnio -= 1
    } else if (nuevoMes > 11) {
      nuevoMes = 0
      nuevoAnio += 1
    }
    setMesVisible(nuevoMes)
    setAnioVisible(nuevoAnio)
  }

  const handleClickDia = (fecha: Date) => {
    if (!inicio || (inicio && fin)) {
      onChange(fecha, null)
      return
    }

    if (fecha < inicio) {
      onChange(fecha, inicio)
    } else {
      onChange(inicio, fecha)
    }
  }

  const enRango = (fecha: Date) => {
    if (!inicio || !fin) return false
    return fecha > inicio && fecha < fin
  }

  const anios = Array.from({ length: 6 }, (_, i) => hoy.getFullYear() - 1 + i)

  return (
    <div className="drc-wrapper">
      <div className="drc-header">
        <button type="button" className="drc-nav" onClick={() => cambiarMes(-1)}>
          <ChevronLeft size={16} />
        </button>

        <select
          className="drc-select"
          value={mesVisible}
          onChange={(e) => setMesVisible(Number(e.target.value))}
        >
          {MESES.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>

        <select
          className="drc-select"
          value={anioVisible}
          onChange={(e) => setAnioVisible(Number(e.target.value))}
        >
          {anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <button type="button" className="drc-nav" onClick={() => cambiarMes(1)}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="drc-grid drc-grid-header">
        {DIAS.map((d) => (
          <span key={d} className="drc-day-label">{d}</span>
        ))}
      </div>

      <div className="drc-grid">
        {dias.map(({ fecha, delMesActual }) => {
          const esInicio = mismodia(fecha, inicio)
          const esFin = mismodia(fecha, fin)
          const dentroDeRango = enRango(fecha)

          const clases = [
            'drc-day',
            !delMesActual && 'drc-day-otro-mes',
            (esInicio || esFin) && 'drc-day-selected',
            dentroDeRango && 'drc-day-in-range',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              type="button"
              key={fecha.toISOString()}
              className={clases}
              onClick={() => handleClickDia(fecha)}
            >
              {fecha.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function formatearRango(inicio: Date | null, fin: Date | null): string {
  if (!inicio) return 'Sin definir'
  const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  if (!fin) return inicio.toLocaleDateString('es-CO', opciones)
  return `${inicio.toLocaleDateString('es-CO', opciones)} — ${fin.toLocaleDateString('es-CO', opciones)}`
}

export { CalendarIcon }
export default DateRangeCalendar