import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, BookOpen, FileCheck2, UserCheck, Scale, FlaskConical, Wallet, Banknote, TableProperties, History, Pin, PinOff, FileSignature, ClipboardList, ListChecks, Inbox, SlidersHorizontal, PieChart, ChevronDown } from 'lucide-react'
import { getRolesEfectivos, type Role } from '../../../modules/auth/lib/auth'
import './Sidebar.css'

interface ItemNav {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles: Role[]
  end?: boolean
  /** Cuándo la entrada se marca como activa, si no basta con coincidir con `to`. */
  coincide?: (ruta: string) => boolean
}

/** Varias pantallas agrupadas bajo un solo ítem desplegable, para no saturar el menú. */
interface GrupoNav {
  id: string
  label: string
  icon: typeof LayoutDashboard
  items: ItemNav[]
}

const esGrupo = (e: ItemNav | GrupoNav): e is GrupoNav => 'items' in e

const itemActivo = (item: ItemNav, ruta: string) =>
  item.coincide ? item.coincide(ruta) : item.end ? ruta === item.to : ruta === item.to || ruta.startsWith(`${item.to}/`)

const allNavItems: (ItemNav | GrupoNav)[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['administrador', 'usuario', 'par_evaluador', 'comite_etica', 'comite_investigacion'],
  },
  { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['administrador'] },
  { to: '/convocatorias', label: 'Convocatorias', icon: FileText, roles: ['administrador'] },
  { to: '/proyectos', label: 'Proyectos', icon: BookOpen, roles: ['administrador', 'usuario'] },
  // "Resultados de Pares" vive como pestaña dentro de Asignaciones, no como
  // entrada propia — junto al resto del flujo de asignación de Pares.
  { to: '/asignaciones', label: 'Asignaciones', icon: UserCheck, roles: ['administrador'] },
  { to: '/formatos-evaluacion', label: 'Formatos de evaluación', icon: FileCheck2, roles: ['administrador'] },
  { to: '/pagos-pares', label: 'Pagos a pares', icon: Banknote, roles: ['administrador'] },
  { to: '/acta-inicio', label: 'Actas de inicio', icon: FileSignature, roles: ['administrador', 'usuario', 'vicerrector'] },
  // Etapa de seguimiento (M-02 a M-08), agrupada en un solo desplegable. El Líder
  // entra solo para firmar el informe técnico final y el acta de cierre de los
  // proyectos de su grupo; quien tenga una sola de estas pantallas la ve como un
  // enlace normal, sin desplegable.
  {
    id: 'seguimiento',
    label: 'Etapa de seguimiento',
    icon: ClipboardList,
    items: [
      {
        to: '/seguimiento',
        label: 'Seguimiento',
        icon: ListChecks,
        roles: ['administrador', 'usuario', 'vicerrector', 'lider'],
        // También es el detalle de un proyecto (/seguimiento/101), pero no Bandejas ni Parámetros.
        coincide: (ruta) => ruta === '/seguimiento' || /^\/seguimiento\/\d+/.test(ruta),
      },
      { to: '/seguimiento/bandejas', label: 'Bandejas de seguimiento', icon: Inbox, roles: ['administrador'] },
      { to: '/seguimiento/parametros', label: 'Parámetros de seguimiento', icon: SlidersHorizontal, roles: ['administrador'] },
    ],
  },
  { to: '/seguimiento/consolidado', label: 'Consolidado institucional', icon: PieChart, roles: ['administrador', 'vicerrector'] },
  { to: '/comite-etica', label: 'Comité de ética', icon: Scale, roles: ['comite_etica'] },
  { to: '/comite-investigacion', label: 'Comité de investigación', icon: FlaskConical, roles: ['comite_investigacion'] },
  // La bandeja de proyectos del Par Evaluador vive dentro de su propio
  // Dashboard ("Proyectos asignados"), no en una sección aparte.
  { to: '/informacion-pagos', label: 'Información de pagos', icon: Wallet, roles: ['par_evaluador'] },
  { to: '/historial-pagos', label: 'Historial de pagos', icon: History, roles: ['par_evaluador'] },
  // El Líder no ve nada más del sistema: solo este consolidado de seguimiento.
  { to: '/seguimiento-proyectos', label: 'Seguimiento de proyectos', icon: TableProperties, roles: ['lider'] },
]

interface SidebarProps {

  mobileOpen: boolean

  onCloseMobile: () => void
}

const CLAVE_SIDEBAR_FIJADO = 'sgpvie_sidebar_fijado'

function leerFijadoGuardado(): boolean {
  try {
    return localStorage.getItem(CLAVE_SIDEBAR_FIJADO) === 'true'
  } catch {
    return false
  }
}

function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const [hoverOpen, setHoverOpen] = useState(false)
  // Fijado: el usuario eligió que el sidebar se quede abierto siempre, sin
  // depender de si el mouse está encima (se recuerda entre sesiones).
  const [fijado, setFijado] = useState(leerFijadoGuardado)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const rolesActivos = getRolesEfectivos()

  // Para Par Evaluador y los comités, lo que hacen en "/dashboard" es
  // revisar/evaluar proyectos asignados — "Dashboard" no deja claro eso,
  // así que ahí se renombra en el menú (la pantalla del Administrador e
  // Investigador sigue diciendo "Dashboard").
  const ROLES_REVISION_PROYECTOS: Role[] = ['par_evaluador', 'comite_etica', 'comite_investigacion']
  const visible = (item: ItemNav) => item.roles.some((r) => rolesActivos.includes(r))
  const renombrar = (item: ItemNav): ItemNav =>
    item.to === '/dashboard' && rolesActivos.some((r) => ROLES_REVISION_PROYECTOS.includes(r))
      ? { ...item, label: 'Revisión de proyectos' }
      : item

  const navItems = allNavItems.flatMap((entrada): (ItemNav | GrupoNav)[] => {
    if (!esGrupo(entrada)) return visible(entrada) ? [renombrar(entrada)] : []
    const items = entrada.items.filter(visible)
    if (items.length === 0) return []
    // Un desplegable con una sola opción no aporta: se muestra directo como enlace.
    if (items.length === 1) return [items[0]]
    return [{ ...entrada, items }]
  })

  // Grupos desplegados. Se abre solo el que contiene la pantalla actual, y el
  // usuario puede abrir o cerrar cualquiera con un clic.
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})
  const grupoActivo = navItems.find((e): e is GrupoNav => esGrupo(e) && e.items.some((i) => itemActivo(i, pathname)))?.id
  useEffect(() => {
    if (grupoActivo) setGruposAbiertos((prev) => (prev[grupoActivo] ? prev : { ...prev, [grupoActivo]: true }))
  }, [grupoActivo])

  const irA = (ruta: string) => {
    onCloseMobile()
    navigate(ruta)
  }

  const toggleFijado = () => {
    const nuevo = !fijado
    setFijado(nuevo)
    try {
      localStorage.setItem(CLAVE_SIDEBAR_FIJADO, String(nuevo))
    } catch {
      // Sin localStorage disponible, el fijado simplemente no se recuerda entre sesiones.
    }
  }

  const abierto = fijado || hoverOpen

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={[
          'sidebar',
          abierto ? 'sidebar-open' : 'sidebar-collapsed',
          mobileOpen ? 'sidebar-mobile-open' : '',
        ].join(' ').trim()}
        onMouseEnter={() => setHoverOpen(true)}
        onMouseLeave={() => setHoverOpen(false)}
      >
        <div className="sidebar-brand-row">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => irA('/inicio')}
            aria-label="Ir al inicio"
          >
            <img src="/SGP.png" alt="SGP-VIE" className="sidebar-brand-logo" />
            <span className="sidebar-brand-text">SGP-VIE</span>
          </button>

          <button
            type="button"
            className={`sidebar-pin-btn ${fijado ? 'sidebar-pin-btn-activo' : ''}`}
            onClick={toggleFijado}
            aria-label={fijado ? 'Dejar de fijar el menú' : 'Fijar el menú abierto'}
            title={fijado ? 'Dejar de fijar el menú' : 'Fijar el menú abierto'}
          >
            {fijado ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((entrada) => {
            if (!esGrupo(entrada)) {
              const { to, label, icon: Icon, end } = entrada
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onCloseMobile}
                  className={({ isActive }) => {
                    const activo = entrada.coincide ? entrada.coincide(pathname) : isActive
                    return `sidebar-link ${activo ? 'sidebar-link-active' : ''}`
                  }}
                >
                  <Icon size={20} />
                  <span className="sidebar-link-label">{label}</span>
                </NavLink>
              )
            }

            const { id, label, icon: Icon, items } = entrada
            const abiertoGrupo = !!gruposAbiertos[id]
            const contieneActivo = items.some((i) => itemActivo(i, pathname))
            return (
              <div key={id} className="sidebar-grupo">
                <button
                  type="button"
                  className={`sidebar-link sidebar-grupo-btn ${contieneActivo ? 'sidebar-grupo-activo' : ''} ${abiertoGrupo ? 'sidebar-grupo-abierto' : ''}`}
                  aria-expanded={abiertoGrupo}
                  aria-controls={`sidebar-grupo-${id}`}
                  title={label}
                  onClick={() => setGruposAbiertos((prev) => ({ ...prev, [id]: !prev[id] }))}
                >
                  <Icon size={20} />
                  <span className="sidebar-link-label">{label}</span>
                  <ChevronDown size={16} className="sidebar-grupo-chevron" aria-hidden="true" />
                </button>

                {abiertoGrupo && (
                  <div id={`sidebar-grupo-${id}`} className="sidebar-subnav">
                    {items.map((item) => {
                      const SubIcon = item.icon
                      const activo = itemActivo(item, pathname)
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={onCloseMobile}
                          aria-current={activo ? 'page' : undefined}
                          className={`sidebar-link sidebar-sublink ${activo ? 'sidebar-link-active' : ''}`}
                        >
                          <SubIcon size={18} />
                          <span className="sidebar-link-label">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar