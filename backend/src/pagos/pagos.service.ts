import { prisma } from "../config/prisma";

const TIPOS_CUENTA_VALIDOS = ["ahorros", "corriente"] as const;

export class TipoCuentaInvalidoError extends Error {
  constructor() {
    super(`tipo_cuenta debe ser uno de: ${TIPOS_CUENTA_VALIDOS.join(", ")}`);
  }
}

export interface DatosBancarios {
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  titular?: string;
  documento_titular?: string;
}

export type TipoDocumentoPago = "rut" | "certificacion_bancaria" | "cedula";

const CAMPO_POR_TIPO_DOCUMENTO: Record<TipoDocumentoPago, "rut_path" | "certificacion_bancaria_path" | "cedula_path"> = {
  rut: "rut_path",
  certificacion_bancaria: "certificacion_bancaria_path",
  cedula: "cedula_path",
};

export class TipoDocumentoPagoInvalidoError extends Error {
  constructor() {
    super(`tipo debe ser uno de: ${Object.keys(CAMPO_POR_TIPO_DOCUMENTO).join(", ")}`);
  }
}

export class DocumentoPagoNoEncontradoError extends Error {
  constructor() {
    super("Todavía no se ha subido este documento");
  }
}

/** Datos bancarios propios del par evaluador logueado, o null si todavía no los registró. */
export async function obtenerDatosBancariosPropios(id_usuario: number) {
  return prisma.datoBancarioPar.findFirst({
    where: { id_usuario },
    orderBy: { id_dato_bancario: "desc" },
  });
}

async function obtenerORegistroPropio(id_usuario: number) {
  return prisma.datoBancarioPar.findFirst({
    where: { id_usuario },
    orderBy: { id_dato_bancario: "desc" },
  });
}

/**
 * El par evaluador registra o actualiza sus propios datos bancarios. Todos
 * los campos son opcionales: puede guardarlos de forma incremental (por
 * ejemplo, subir primero los documentos y completar el texto después). Solo
 * se guarda UN registro activo por usuario: si ya existía, se actualiza en
 * vez de duplicar.
 */
export async function guardarDatosBancariosPropios(id_usuario: number, datos: DatosBancarios) {
  const tipo_cuenta = datos.tipo_cuenta?.trim().toLowerCase();
  if (tipo_cuenta && !TIPOS_CUENTA_VALIDOS.includes(tipo_cuenta as (typeof TIPOS_CUENTA_VALIDOS)[number])) {
    throw new TipoCuentaInvalidoError();
  }

  const data = {
    ...(datos.banco !== undefined ? { banco: datos.banco.trim() || null } : {}),
    ...(tipo_cuenta !== undefined ? { tipo_cuenta: tipo_cuenta || null } : {}),
    ...(datos.numero_cuenta !== undefined ? { numero_cuenta: datos.numero_cuenta.trim() || null } : {}),
    ...(datos.titular !== undefined ? { titular: datos.titular.trim() || null } : {}),
    ...(datos.documento_titular !== undefined ? { documento_titular: datos.documento_titular.trim() || null } : {}),
  };

  const existente = await obtenerORegistroPropio(id_usuario);
  if (existente) {
    return prisma.datoBancarioPar.update({ where: { id_dato_bancario: existente.id_dato_bancario }, data });
  }
  return prisma.datoBancarioPar.create({ data: { id_usuario, ...data } });
}

/**
 * Registra el archivo subido (RUT, certificación bancaria o cédula) para el
 * par evaluador logueado. Si todavía no tiene un registro de datos
 * bancarios, lo crea vacío salvo por este documento.
 */
export async function guardarDocumentoPagoPropio(id_usuario: number, tipo: TipoDocumentoPago, nombreArchivo: string) {
  const campo = CAMPO_POR_TIPO_DOCUMENTO[tipo];
  if (!campo) throw new TipoDocumentoPagoInvalidoError();

  const existente = await obtenerORegistroPropio(id_usuario);
  if (existente) {
    return prisma.datoBancarioPar.update({
      where: { id_dato_bancario: existente.id_dato_bancario },
      data: { [campo]: nombreArchivo },
    });
  }
  return prisma.datoBancarioPar.create({ data: { id_usuario, [campo]: nombreArchivo } });
}

/** Ruta en disco (nombre de archivo generado al subir) de un documento propio, para descargarlo. */
export async function obtenerRutaDocumentoPagoPropio(id_usuario: number, tipo: TipoDocumentoPago): Promise<string> {
  const campo = CAMPO_POR_TIPO_DOCUMENTO[tipo];
  if (!campo) throw new TipoDocumentoPagoInvalidoError();

  const registro = await obtenerORegistroPropio(id_usuario);
  const nombreArchivo = registro?.[campo];
  if (!nombreArchivo) throw new DocumentoPagoNoEncontradoError();
  return nombreArchivo;
}

/**
 * Historial de pagos del par evaluador logueado: una fila por cada
 * evaluación de Pares que hizo, con el pago asociado si ya se registró uno
 * (todavía no existe pantalla para que el Administrador registre pagos, así
 * que hoy esto normalmente viene vacío de "pagado").
 */
export async function listarHistorialPagosPropio(id_usuario: number) {
  const evaluaciones = await prisma.evaluacionEtapa.findMany({
    where: { evaluado_por: id_usuario, etapa: { nombre: "Pares" } },
    include: {
      proyecto: { select: { id_proyecto: true, titulo: true } },
      pagos: { orderBy: { fecha_pago: "desc" }, take: 1 },
    },
    orderBy: { fecha_evaluacion: "desc" },
  });

  return evaluaciones.map((e) => {
    const pago = e.pagos[0] ?? null;
    return {
      id_evaluacion: e.id_evaluacion,
      proyecto: e.proyecto,
      valor_pago: pago?.valor_pago ?? null,
      pagado: pago?.pagado ?? false,
      tiene_comprobante: Boolean(pago?.comprobante_pago),
      id_pago: pago?.id_pago ?? null,
    };
  });
}

/** Ruta en disco del comprobante de un pago propio, para descargarlo. */
export async function obtenerRutaComprobantePropio(id_usuario: number, id_pago: number): Promise<string> {
  const pago = await prisma.pagoPar.findFirst({
    where: { id_pago, evaluacion: { evaluado_por: id_usuario } },
  });
  if (!pago?.comprobante_pago) throw new DocumentoPagoNoEncontradoError();
  return pago.comprobante_pago;
}
