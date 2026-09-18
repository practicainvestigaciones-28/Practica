import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Shield, Scale, UserCheck, BookOpen, Users, type LucideIcon } from 'lucide-react'
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
    nombre: NOMBRES_ROL_REAL.comite_investigacion,
    titulo: 'Comité de Investigación',
    descripcion: 'Revisa y asigna los proyectos al comité de investigación.',
    icon: Users,
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
  const [seleccionado, setSeleccionado] = useState<string | null>(null)

  if (!usuario) return null

  // El administrador ve las 4 opciones así su cuenta solo tenga
  // "Administrador" asignado — tiene acceso total a cualquier vista.
  const esAdministrador = usuario.roles.includes(NOMBRES_ROL_REAL.administrador)
  const disponibles = esAdministrador
    ? opcionesRol
    : opcionesRol.filter((o) => usuario.roles.includes(o.nombre))

  // Solo se puede trabajar con UN rol por sesión: se marca primero y hay
  // que confirmar con "Continuar" — no se entra de una con el primer clic.
  const continuar = () => {
    if (!seleccionado) return
    setRolesActivos([seleccionado])
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
              ? 'Como administrador puedes ingresar con cualquier rol — elige con cuál vas a trabajar en esta sesión.'
              : 'Tu cuenta tiene más de un rol — elige con cuál vas a trabajar en esta sesión.'}
          </p>
        </div>

        <div className="selrol-opciones">
          {disponibles.map((opcion) => {
            const Icon = opcion.icon
            const activo = seleccionado === opcion.nombre
            return (
              <button
                type="button"
                className={`selrol-opcion${activo ? ' selrol-opcion-activo' : ''}`}
                key={opcion.nombre}
                onClick={() => setSeleccionado(opcion.nombre)}
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
          disabled={!seleccionado}
          onClick={continuar}
        >
          Continuar
        </button>
      </div>
    </main>
  )
}

export default SeleccionarRol
