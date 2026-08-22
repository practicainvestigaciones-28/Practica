import { prisma } from "../config/prisma";

export async function crearEtapa(nombre: string, descripcion?: string) {
  return prisma.etapa.create({ data: { nombre, descripcion } });
}
export async function listarEtapas() {
  return prisma.etapa.findMany({ orderBy: { id_etapa: "asc" } });
}

/** RQF36 - Gestión de tipos de documentos por etapa (catálogo, solo Admin) */
export async function crearTipoDocumento(datos: {
  id_etapa: number;
  nombre: string;
  descripcion?: string;
  archivo?: string;
}) {
  return prisma.tipoDocumento.create({ data: datos });
}

export async function listarTiposDocumento(filtros: { id_etapa?: number; soloActivos?: boolean }) {
  return prisma.tipoDocumento.findMany({
    where: {
      ...(filtros.id_etapa ? { id_etapa: filtros.id_etapa } : {}),
      ...(filtros.soloActivos ? { activo: true } : {}),
    },
    include: { etapa: true },
    orderBy: { id_tipo_documento: "asc" },
  });
}

export async function actualizarTipoDocumento(
  id_tipo_documento: number,
  cambios: { nombre?: string; descripcion?: string; archivo?: string; activo?: boolean }
) {
  return prisma.tipoDocumento.update({ where: { id_tipo_documento }, data: cambios });
}
