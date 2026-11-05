import crypto from "node:crypto";
import { prisma } from "../config/prisma";

/** Documentos que se firman con el sistema de firma por código (acta de inicio, informes y acta de cierre). */
export type TipoDocumentoFirmado = "acta_inicio" | "informe_avance" | "informe_final" | "acta_cierre";

export interface EvidenciaFirmaDocumento {
  id_transaccion: string;
  hash_firma: string;
}

/** Contenido del documento tal como está en el momento de firmar; entra en la huella para que cualquier cambio posterior se note. */
async function contenidoDelDocumento(tipo: TipoDocumentoFirmado, id_referencia: number): Promise<unknown> {
  switch (tipo) {
    case "acta_inicio":
      return prisma.actaInicio.findUnique({ where: { id_acta_inicio: id_referencia } });
    case "informe_avance":
      return prisma.informeAvance.findUnique({
        where: { id_informe_avance: id_referencia },
        include: { actividades: { orderBy: { id_actividad: "asc" }, include: { evidencias: { orderBy: { id_evidencia: "asc" } } } } },
      });
    case "informe_final":
      return prisma.informeFinal.findUnique({
        where: { id_informe_final: id_referencia },
        include: {
          personas: { orderBy: { rol: "asc" } },
          cumplimientos: { orderBy: { id_cumplimiento: "asc" } },
          resultadosProductos: { orderBy: { id_resultado_producto: "asc" } },
        },
      });
    case "acta_cierre":
      return prisma.actaCierre.findUnique({ where: { id_acta_cierre: id_referencia } });
  }
}

/**
 * Evidencia de una firma electrónica: un ID único del acto de firmar y la huella SHA-256 de lo firmado (firmante + fecha +
 * ID + contenido del documento en ese momento). El JSON se arma siempre con las mismas claves y en el mismo orden, para que el
 * hash se pueda recalcular.
 */
export async function sellarFirmaDocumento(datos: {
  tipo: TipoDocumentoFirmado;
  id_proyecto: number;
  id_referencia: number;
  firmante: { nombre: string; rol: string };
  fecha: Date;
}): Promise<EvidenciaFirmaDocumento> {
  const [proyecto, contenido] = await Promise.all([
    prisma.proyecto.findUnique({ where: { id_proyecto: datos.id_proyecto }, select: { titulo: true } }),
    contenidoDelDocumento(datos.tipo, datos.id_referencia),
  ]);
  const id_transaccion = `F-${datos.id_proyecto}-${crypto.randomUUID()}`;
  const documento = {
    id_transaccion,
    fecha_firma: datos.fecha.toISOString(),
    firmante: { nombre: datos.firmante.nombre, rol: datos.firmante.rol },
    documento: { tipo: datos.tipo, id_referencia: datos.id_referencia, id_proyecto: datos.id_proyecto, titulo: proyecto?.titulo ?? "", contenido },
  };
  const hash_firma = crypto.createHash("sha256").update(JSON.stringify(documento)).digest("hex");
  return { id_transaccion, hash_firma };
}
