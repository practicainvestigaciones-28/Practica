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

/** Las 4 categorías de investigador avaladas por MinCiencias (de mayor a menor trayectoria). */
export const CATEGORIAS_MINCIENCIAS = [
  "Investigador Emérito",
  "Investigador Senior",
  "Investigador Asociado",
  "Investigador Junior",
] as const;

export class CategoriaMinCienciasInvalidaError extends Error {
  constructor() {
    super(`La categoría MinCiencias debe ser una de: ${CATEGORIAS_MINCIENCIAS.join(", ")}`);
  }
}

export interface DatosHojaVida {
  nombres?: string;
  apellidos?: string;
  correo?: string;
  lugar_nacimiento?: string;
  fecha_nacimiento?: Date;
  nacionalidad?: string;
  tipo_documento?: string;
  numero_documento?: string;
  direccion?: string;
  telefono?: string;
  celular?: string;
  orcid?: string;
  google_academico?: string;
  cargo_actual?: string;
  cargos_desempenados?: string;
  titulos_academicos?: string;
  produccion_cientifica?: string;
  categoria_minciencias?: string;
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

  if (
    datos.categoria_minciencias != null &&
    !CATEGORIAS_MINCIENCIAS.includes(datos.categoria_minciencias as (typeof CATEGORIAS_MINCIENCIAS)[number])
  ) {
    throw new CategoriaMinCienciasInvalidaError();
  }

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
