export interface Usuario {
  id: number
  nombre: string
  apellido: string
  cedula: string
  codigo: string
  correo: string
  rol: string
  totalProyectos: number
  activo: boolean
}

const STORAGE_KEY = 'sgpvie_usuarios'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const usuariosSemilla: Usuario[] = [
  { id: 1, nombre: 'Usuario', apellido: '1', cedula: '', codigo: '', correo: 'usuario1@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 3, activo: true },
  { id: 2, nombre: 'Usuario', apellido: '2', cedula: '', codigo: '', correo: 'usuario2@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 2, activo: false },
  { id: 3, nombre: 'Usuario', apellido: '3', cedula: '', codigo: '', correo: 'usuario3@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 3, activo: false },
  { id: 4, nombre: 'Usuario', apellido: '4', cedula: '', codigo: '', correo: 'usuario4@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 1, activo: true },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que lib/convocatorias.ts, lib/roles.ts y lib/periodos.ts:
// persistimos en localStorage para que los cambios sean visibles entre
// pestañas sin necesitar backend todavía. Cuando tu compañero tenga los
// endpoints reales (GET/POST/PUT a /api/usuarios), se reemplaza
// cargarInicial()/guardar() por los fetch correspondientes.
//
// NOTA: la contraseña del formulario NUNCA se guarda aquí (ni en
// localStorage ni en este objeto), a propósito — no debe vivir en texto
// plano en el navegador. Se recibe en Usuarios.tsx y solo se deja un
// console.log de aviso; el backend real es quien debe hashearla y
// guardarla.

function cargarInicial(): Usuario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Usuario[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return usuariosSemilla
}

function guardar(lista: Usuario[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let usuarios: Usuario[] = cargarInicial()

export function getUsuarios(): Usuario[] {
  return usuarios
}

export interface DatosUsuarioForm {
  nombre: string
  apellido: string
  cedula: string
  codigo: string
  correo: string
  rol: string
}

export function addUsuario(datos: DatosUsuarioForm): void {
  usuarios = [
    ...usuarios,
    { id: Date.now(), ...datos, totalProyectos: 0, activo: true },
  ]
  guardar(usuarios)
}

export function editarUsuario(id: number, datos: DatosUsuarioForm): void {
  usuarios = usuarios.map((u) => (u.id === id ? { ...u, ...datos } : u))
  guardar(usuarios)
}

export function eliminarUsuario(id: number): void {
  usuarios = usuarios.filter((u) => u.id !== id)
  guardar(usuarios)
}

export function toggleUsuarioActivo(id: number): void {
  usuarios = usuarios.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u))
  guardar(usuarios)
}