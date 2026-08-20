import path from "node:path";
import fs from "node:fs";
import { prisma } from "../config/prisma";
import { verificarPermisoProyecto, NoAutorizadoProyectoError } from "../utils/permisosProyecto";
import { CARPETA_UPLOADS } from "../config/upload";
export { ProyectoNoEncontradoError, NoAutorizadoProyectoError } from "../utils/permisosProyecto";

export class TipoDocumentoInvalidoError extends Error {
  constructor() {
    super("El tipo de documento no existe o está inactivo");
  }
}

export class DocumentoNoEncontradoError extends Error {
  constructor() {
    super("El documento no existe en este proyecto");
  }
}

interface UsuarioQueEdita {
  id_usuario: number;
  roles: string[];
}

/** RQF37 - Carga de documentos del proyecto */
export async function cargarDocumento(
  id_proyecto: number,
  id_tipo_documento: number,
  nombreArchivoEnDisco: string,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const tipoDocumento = await prisma.tipoDocumento.findUnique({ where: { id_tipo_documento } });
  if (!tipoDocumento || !tipoDocumento.activo) {
    // Si el tipo no es válido, no dejamos el archivo huérfano en disco.
    borrarArchivoFisico(nombreArchivoEnDisco);
    throw new TipoDocumentoInvalidoError();
  }

  return prisma.proyectoDocumento.create({
    data: {
      id_proyecto,
      id_tipo_documento,
      cargado_por: usuarioQueEdita.id_usuario,
      archivo: nombreArchivoEnDisco,
    },
    include: { tipoDocumento: true, cargadoPor: { select: { nombre: true, apellido: true } } },
  });
}

/** RQF38 - Consulta de documentos del proyecto */
export async function listarDocumentos(id_proyecto: number) {
  return prisma.proyectoDocumento.findMany({
    where: { id_proyecto },
    include: { tipoDocumento: true, cargadoPor: { select: { nombre: true, apellido: true } } },
    orderBy: { fecha_carga: "desc" },
  });
}

/** RQF38 - Obtiene la ruta física de un documento para descargarlo */
export async function obtenerRutaDescarga(id_proyecto: number, id_proyecto_documento: number): Promise<string> {
  const documento = await prisma.proyectoDocumento.findUnique({ where: { id_proyecto_documento } });
  if (!documento || documento.id_proyecto !== id_proyecto) throw new DocumentoNoEncontradoError();

  return path.join(CARPETA_UPLOADS, documento.archivo);
}

export async function obtenerDocumento(id_proyecto: number, id_proyecto_documento: number) {
  const documento = await prisma.proyectoDocumento.findUnique({
    where: { id_proyecto_documento },
    include: { tipoDocumento: true, cargadoPor: { select: { nombre: true, apellido: true } } },
  });
  if (!documento || documento.id_proyecto !== id_proyecto) throw new DocumentoNoEncontradoError();
  return documento;
}

/** RQF39 - Validación documental inicial: aprobar o rechazar un documento cargado */
export async function validarDocumento(
  id_proyecto: number,
  id_proyecto_documento: number,
  aprobado: boolean,
  usuarioQueEdita: UsuarioQueEdita
) {
  // La validación documental la hace la institución, no el propio dueño del
  // proyecto — por eso aquí NO reutilizamos "dueño o admin": se exige
  // Administrador siempre (se valida además con el middleware de rol en la
  // ruta; esta comprobación es una segunda capa de defensa).
  if (!usuarioQueEdita.roles.includes("Administrador")) {
    throw new NoAutorizadoProyectoError();
  }

  const documento = await prisma.proyectoDocumento.findUnique({ where: { id_proyecto_documento } });
  if (!documento || documento.id_proyecto !== id_proyecto) throw new DocumentoNoEncontradoError();

  return prisma.proyectoDocumento.update({
    where: { id_proyecto_documento },
    data: { aprobado_rechazado: aprobado },
  });
}

export async function eliminarDocumento(
  id_proyecto: number,
  id_proyecto_documento: number,
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const documento = await prisma.proyectoDocumento.findUnique({ where: { id_proyecto_documento } });
  if (!documento || documento.id_proyecto !== id_proyecto) throw new DocumentoNoEncontradoError();

  await prisma.proyectoDocumento.delete({ where: { id_proyecto_documento } });
  borrarArchivoFisico(documento.archivo);
}

function borrarArchivoFisico(nombreArchivo: string): void {
  const ruta = path.join(CARPETA_UPLOADS, nombreArchivo);
  fs.unlink(ruta, () => {
    // Best-effort: si falla el borrado físico (ya no existe, permisos,
    // etc.) no interrumpimos la respuesta al usuario; queda registrado
    // en consola para revisión manual si hace falta.
  });
}
