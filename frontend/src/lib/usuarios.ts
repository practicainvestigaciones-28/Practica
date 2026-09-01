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


const usuariosSemilla: Usuario[] = [
  { id: 1, nombre: 'Usuario', apellido: '1', cedula: '', codigo: '', correo: 'usuario1@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 3, activo: true },
  { id: 2, nombre: 'Usuario', apellido: '2', cedula: '', codigo: '', correo: 'usuario2@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 2, activo: false },
  { id: 3, nombre: 'Usuario', apellido: '3', cedula: '', codigo: '', correo: 'usuario3@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 3, activo: false },
  { id: 4, nombre: 'Usuario', apellido: '4', cedula: '', codigo: '', correo: 'usuario4@unicesmag.edu.co', rol: 'Investigador', totalProyectos: 1, activo: true },
]



function cargarInicial(): Usuario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Usuario[]
  } catch {

  }
  return usuariosSemilla
}

function guardar(lista: Usuario[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

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