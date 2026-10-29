import fs from "node:fs";
import path from "node:path";
import { prisma } from "../config/prisma";
import { CARPETA_FOTOS_PERFIL } from "../config/upload";

function borrarArchivo(nombre: string | null | undefined): void {
  if (!nombre) return;
  fs.unlink(path.join(CARPETA_FOTOS_PERFIL, path.basename(nombre)), () => {
    // Best-effort: si ya no existe, no hay nada que hacer.
  });
}

/** Guarda la nueva foto del usuario y borra la anterior del disco. */
export async function guardarFotoPerfil(id_usuario: number, nombreArchivo: string): Promise<void> {
  const anterior = await prisma.usuario.findUnique({ where: { id_usuario }, select: { foto_perfil: true } });
  await prisma.usuario.update({ where: { id_usuario }, data: { foto_perfil: nombreArchivo } });
  borrarArchivo(anterior?.foto_perfil);
}

/** Ruta absoluta de la foto del usuario, o null si no tiene (o el archivo ya no está). */
export async function rutaFotoPerfil(id_usuario: number): Promise<string | null> {
  const usuario = await prisma.usuario.findUnique({ where: { id_usuario }, select: { foto_perfil: true } });
  if (!usuario?.foto_perfil) return null;
  const ruta = path.join(CARPETA_FOTOS_PERFIL, path.basename(usuario.foto_perfil));
  return fs.existsSync(ruta) ? ruta : null;
}

export async function quitarFotoPerfil(id_usuario: number): Promise<void> {
  const usuario = await prisma.usuario.findUnique({ where: { id_usuario }, select: { foto_perfil: true } });
  await prisma.usuario.update({ where: { id_usuario }, data: { foto_perfil: null } });
  borrarArchivo(usuario?.foto_perfil);
}
