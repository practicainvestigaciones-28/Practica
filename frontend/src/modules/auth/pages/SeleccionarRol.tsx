import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Shield, Scale, UserCheck, BookOpen, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { setRolesActivos, NOMBRES_ROL_REAL } from '../lib/auth'
import './Login.css'
import './SeleccionarRol.css'

interface OpcionRol {
  nombre: string
  titulo: string
  descripcion: string
  icon: LucideIcon
}

const opcionesRol: OpcionRol[] = [
  {
    nombre: NOMBRES_ROL_REAL.administrador,
    titulo: 'Administrador',
    descripcion: 'Gestiona convocatorias, usuarios y catálogos del sistema.',
    icon: Shield,
  },
  {
    nombre: NOMBRES_ROL_REAL.comite_etica,
    titulo: 'Comité de Ética',
    descripcion: 'Revisa y asigna el componente ético de los proyectos.',
    icon: Scale,
  },
  {
    nombre: NOMBRES_ROL_REAL.par_evaluador,
    titulo: 'Par Evaluador',
    descripcion: 'Califica los proyectos que te sean asignados.',
    icon: UserCheck,
  },
  {
    nombre: NOMBRES_ROL_REAL.usuario,
    titulo: 'Investigador',
    descripcion: 'Crea y da seguimiento a tus proyectos de investigación.',
    icon: BookOpen,
  },
]

function SeleccionarRol() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [seleccionados, setSeleccionados] = useState<string[]>([])

  if (!usuario) return null

  // El administrador ve las 4 opciones así su cuenta solo tenga
  // "Administrador" asignado — tiene acceso total a cualquier vista.
  const esAdministrador = usuario.roles.includes(NOMBRES_ROL_REAL.administrador)
  const disponibles = esAdministrador
    ? opcionesRol
    : opcionesRol.filter((o) => usuario.roles.includes(o.nombre))

  const toggle = (nombreRol: string) => {
    setSeleccionados((prev) =>
      prev.includes(nombreRol) ? prev.filter((r) => r !== nombreRol) : [...prev, nombreRol]
    )
  }

  const continuar = () => {
    if (seleccionados.length === 0) return
    setRolesActivos(seleccionados)
    navigate('/inicio', { replace: true })
  }

  return (
    <main className="login-page">
      <div className="selrol-card">
        <div className="selrol-card-header">
          <h1>¿Con qué rol quieres ingresar?</h1>
          <p>
            Hola, <strong>{usuario.nombre}</strong>.{' '}
            {esAdministrador
              ? 'Como administrador puedes ingresar con uno o varios roles a la vez — elige con cuáles vas a trabajar en esta sesión.'
              : 'Tu cuenta tiene más de un rol — puedes elegir uno o varios para esta sesión.'}
          </p>
        </div>

        <div className="selrol-opciones">
          {disponibles.map((opcion) => {
            const Icon = opcion.icon
            const activo = seleccionados.includes(opcion.nombre)
            return (
              <button
                type="button"
                className={`selrol-opcion${activo ? ' selrol-opcion-activo' : ''}`}
                key={opcion.nombre}
                onClick={() => toggle(opcion.nombre)}
                aria-pressed={activo}
              >
                {activo && (
                  <span className="selrol-opcion-check">
                    <Check size={14} />
                  </span>
                )}
                <span className="selrol-opcion-icon">
                  <Icon size={26} />
                </span>
                <span className="selrol-opcion-titulo">{opcion.titulo}</span>
                <span className="selrol-opcion-descripcion">{opcion.descripcion}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="selrol-continuar"
          disabled={seleccionados.length === 0}
          onClick={continuar}
        >
          {seleccionados.length > 1
            ? `Continuar con ${seleccionados.length} roles`
            : 'Continuar'}
        </button>
      </div>
    </main>
  )
}

export default SeleccionarRol
