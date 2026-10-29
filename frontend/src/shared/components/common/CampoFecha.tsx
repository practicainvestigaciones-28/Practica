import DatePicker, { registerLocale } from 'react-datepicker'
import { es } from 'date-fns/locale/es'
import 'react-datepicker/dist/react-datepicker.css'
import './CampoFecha.css'

registerLocale('es', es)

// Las fechas viajan como "AAAA-MM-DD" (igual que un <input type="date">);
// estas dos conversiones evitan que, al pasar por un objeto Date, la zona
// horaria local corra el día un día hacia atrás.
function fechaStringADate(valor: string): Date | null {
  if (!valor) return null
  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number)
  if (!anio || !mes || !dia) return null
  return new Date(anio, mes - 1, dia)
}

function dateAFechaString(fecha: Date | null): string {
  if (!fecha) return ''
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

interface CampoFechaProps {
  /** "AAAA-MM-DD" o vacío. */
  value: string
  onChange: (valor: string) => void
  /** Límites en "AAAA-MM-DD". */
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}

/** Calendario en español (dd/mm/aaaa, con selector de mes y año), el mismo de la Hoja de Vida. */
function CampoFecha({ value, onChange, min, max, disabled, className }: CampoFechaProps) {
  return (
    <DatePicker
      locale="es"
      selected={fechaStringADate(value)}
      onChange={(fecha: Date | null) => onChange(dateAFechaString(fecha))}
      dateFormat="dd/MM/yyyy"
      placeholderText="dd/mm/aaaa"
      minDate={min ? fechaStringADate(min) ?? undefined : undefined}
      maxDate={max ? fechaStringADate(max) ?? undefined : undefined}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      disabled={disabled}
      className={className}
      wrapperClassName="campo-fecha"
      // El calendario se dibuja aparte, al final de la página: si quedara
      // dentro de un <label> (como en el Acta de Inicio), el navegador mandaría
      // cada clic al campo de texto (no se podría elegir mes ni año) y el label
      // le heredaría su letra y color.
      portalId="campo-fecha-calendario"
    />
  )
}

export default CampoFecha
