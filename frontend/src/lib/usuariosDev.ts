import type { UsuarioSesion } from '../api/auth'

export const PREFIJO_TOKEN_LOCAL_DEV = 'dev-local-'

export function esTokenLocalDev(token: string | null): boolean {
  return !!token && token.startsWith(PREFIJO_TOKEN_LOCAL_DEV)
}

interface CuentaLocalDev {
  correo: string
  contraseña: string
  usuario: UsuarioSesion
}

export const cuentasLocalesDev: CuentaLocalDev[] = import.meta.env.DEV
  ? [
      {
        correo: 'ana.etica@local.dev',
        contraseña: 'local123',
        usuario: {
          id_usuario: -1,
          nombre: 'Ana',
          apellido: '(cuenta local — Comité de ética)',
          correo: 'ana.etica@local.dev',

          roles: ['Comité de Ética'],
        },
      },
      {
        correo: 'pedro.evaluador@local.dev',
        contraseña: 'local123',
        usuario: {
          id_usuario: -2,
          nombre: 'Pedro',
          apellido: '(cuenta local — Par Evaluador)',
          correo: 'pedro.evaluador@local.dev',

          roles: ['Par Evaluador'],
        },
      },
    ]
  : []

export function buscarCuentaLocalDev(correo: string, contraseña: string): UsuarioSesion | null {
  const normalizado = correo.trim().toLowerCase()
  const cuenta = cuentasLocalesDev.find((c) => c.correo.toLowerCase() === normalizado && c.contraseña === contraseña)
  return cuenta ? cuenta.usuario : null
}
