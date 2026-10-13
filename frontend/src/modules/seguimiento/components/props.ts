import type { Role } from '../../auth/lib/auth'
import type { ProyectoSeguimiento } from '../api/tipos'
import type { Ejecutar } from '../lib/useAccion'

/** Lo que recibe cada pestaña de la vista de un proyecto en seguimiento. */
export interface PropsPestana {
  proyecto: ProyectoSeguimiento
  roles: Role[]
  ejecutar: Ejecutar
  ocupado: boolean
  /** Finalizado o cancelado: todo queda de solo lectura. */
  bloqueado: boolean
}
