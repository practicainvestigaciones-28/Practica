import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '../../modules/auth/context/AuthContext'
import { esTokenLocalDev } from '../../modules/auth/lib/usuariosDev'

/** Mismos nombres de recurso que `backend/src/ws/socket.ts` (RecursoCambio). */
export type RecursoCambio =
  | 'usuarios'
  | 'proyectos'
  | 'proyecto-detalle'
  | 'convocatorias'
  | 'grupos'
  | 'productos'
  | 'reclamaciones'
  | 'pagos'
  | 'evaluaciones'
  | 'seguimiento'
  | 'acta-inicio'
  | 'notificaciones'
  | 'catalogos'

interface PayloadCambio {
  recurso: RecursoCambio
  id_proyecto?: number
}

type Escucha = (payload: PayloadCambio) => void

interface RealtimeContextValue {
  suscribir: (recurso: RecursoCambio, escucha: Escucha) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  // Un solo listener de socket.io por recurso, que a su vez avisa a todos los
  // componentes suscritos a ese recurso — así cada pantalla no abre su propio
  // listener de socket.io por separado.
  const escuchasPorRecurso = useRef<Map<RecursoCambio, Set<Escucha>>>(new Map())

  useEffect(() => {
    // Las cuentas locales de desarrollo no tienen un JWT real que el backend
    // pueda validar — no tiene sentido intentar conectarlas.
    if (!token || esTokenLocalDev(token)) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      reconnection: true,
    })
    socketRef.current = socket

    socket.on('cambio', (payload: PayloadCambio) => {
      const escuchas = escuchasPorRecurso.current.get(payload.recurso)
      escuchas?.forEach((escucha) => escucha(payload))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const suscribir = (recurso: RecursoCambio, escucha: Escucha) => {
    if (!escuchasPorRecurso.current.has(recurso)) {
      escuchasPorRecurso.current.set(recurso, new Set())
    }
    escuchasPorRecurso.current.get(recurso)!.add(escucha)
    return () => {
      escuchasPorRecurso.current.get(recurso)?.delete(escucha)
    }
  }

  return <RealtimeContext.Provider value={{ suscribir }}>{children}</RealtimeContext.Provider>
}

/**
 * Se suscribe a avisos de cambio para uno o varios recursos y llama a
 * `onCambio` (con un debounce corto, para no refrescar varias veces seguidas
 * si llegan varios eventos juntos). No pasa ningún dato del registro que
 * cambió — cada pantalla sigue pidiendo lo suyo por la API REST de siempre.
 */
export function useCambios(recurso: RecursoCambio | RecursoCambio[], onCambio: (payload: PayloadCambio) => void) {
  const ctx = useContext(RealtimeContext)
  const onCambioRef = useRef(onCambio)
  onCambioRef.current = onCambio

  const recursos = Array.isArray(recurso) ? recurso : [recurso]
  const claveRecursos = recursos.join(',')

  useEffect(() => {
    if (!ctx) return

    let temporizador: ReturnType<typeof setTimeout> | null = null
    let ultimoPayload: PayloadCambio | null = null
    const dispararDebounced = (payload: PayloadCambio) => {
      ultimoPayload = payload
      if (temporizador) clearTimeout(temporizador)
      temporizador = setTimeout(() => {
        if (ultimoPayload) onCambioRef.current(ultimoPayload)
      }, 400)
    }

    const bajas = claveRecursos.split(',').map((r) => ctx.suscribir(r as RecursoCambio, dispararDebounced))
    return () => {
      if (temporizador) clearTimeout(temporizador)
      bajas.forEach((baja) => baja())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, claveRecursos])
}
