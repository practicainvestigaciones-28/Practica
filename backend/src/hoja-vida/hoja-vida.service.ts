import { prisma } from "../config/prisma";

export class UsuarioNoEncontradoError extends Error {
  constructor() {
    super("El usuario no existe");
  }
}

export class NoAutorizadoHojaVidaError extends Error {
  constructor() {
    super("Solo puedes editar tu propia hoja de vida (o ser Administrador)");
  }
}

export interface DatosHojaVida {
  lugar_nacimiento?: string;
  fecha_nacimiento?: Date;
  nacionalidad?: string;
  tipo_documento?: string;
  direccion?: string;
  telefono?: string;
  celular?: string;
  cargo_actual?: string;
  cargos_desempenados?: string;
  titulos_academicos?: string;
  produccion_cientifica?: string;
}

/**
 * RQF35 - Registrar/actualizar la hoja de vida resumida de un investigador.
 * Solo el propio usuario o un Administrador pueden editarla.
 */
export async function registrarHojaVida(
  id_usuario: number,
  datos: DatosHojaVida,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  const esPropia = id_usuario === usuarioQueEdita.id_usuario;
  const esAdmin = usuarioQueEdita.roles.includes("Administrador");
  if (!esPropia && !esAdmin) throw new NoAutorizadoHojaVidaError();

  const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
  if (!usuario) throw new UsuarioNoEncontradoError();

  return prisma.hojaVida.upsert({
    where: { id_usuario },
    update: datos,
    create: { id_usuario, ...datos },
  });
}

/** Cualquier usuario autenticado puede consultar una hoja de vida (se usa en evaluaciones, asignaciones, etc.) */
export async function obtenerHojaVida(id_usuario: number) {
  return prisma.hojaVida.findUnique({
    where: { id_usuario },
    include: { usuario: { select: { nombre: true, apellido: true, correo: true, cedula: true } } },
  });
}
