import path from "node:path";
import { prisma } from "../config/prisma";
import { CARPETA_UPLOADS } from "../config/upload";
import { enviarCorreoAgradecimientoPar } from "../auth/email.service";

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

export class EvaluacionNoEncontradaError extends Error {
  constructor() {
    super("La evaluación indicada no existe");
  }
}

export class DatosBancariosRequeridosError extends Error {
  constructor() {
    super("El par evaluador todavía no registró sus datos bancarios — no se puede registrar el pago");
  }
}

export class PagoNoEncontradoError extends Error {
  constructor() {
    super("El pago indicado no existe");
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
      tiene_certificado: Boolean(pago?.certificado_path),
      agradecimiento_enviado: Boolean(pago?.fecha_agradecimiento),
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

// ---------------------------------------------------------------------------
// Vista del Administrador: ver los datos/documentos de CUALQUIER par
// evaluador y registrar los pagos pendientes por sus evaluaciones de Pares.
// ---------------------------------------------------------------------------

/**
 * Un par evaluador por fila, con cuántos proyectos de Pares evaluó, cuántos
 * de esos pagos quedan pendientes, y si ya completó sus datos/documentos
 * bancarios (sin eso no se le puede registrar ningún pago, ver registrarPago).
 */
export async function listarParesConResumenPagos() {
  const pares = await prisma.usuario.findMany({
    where: { activo: true, roles: { some: { rol: { nombre: "Par Evaluador" } } } },
    select: { id_usuario: true, nombre: true, apellido: true, correo: true },
    orderBy: { nombre: "asc" },
  });

  return Promise.all(
    pares.map(async (par) => {
      const [evaluaciones, datoBancario] = await Promise.all([
        prisma.evaluacionEtapa.findMany({
          where: { evaluado_por: par.id_usuario, etapa: { nombre: "Pares" } },
          include: { pagos: { orderBy: { fecha_pago: "desc" }, take: 1 } },
        }),
        prisma.datoBancarioPar.findFirst({ where: { id_usuario: par.id_usuario }, orderBy: { id_dato_bancario: "desc" } }),
      ]);

      const proyectosEvaluados = evaluaciones.length;
      const pagosRealizados = evaluaciones.filter((e) => e.pagos[0]?.pagado).length;

      return {
        id_usuario: par.id_usuario,
        nombre: par.nombre,
        apellido: par.apellido,
        correo: par.correo,
        proyectos_evaluados: proyectosEvaluados,
        pagos_pendientes: proyectosEvaluados - pagosRealizados,
        tiene_datos_bancarios: Boolean(datoBancario),
        documentos_completos: Boolean(
          datoBancario?.rut_path && datoBancario?.certificacion_bancaria_path && datoBancario?.cedula_path
        ),
      };
    })
  );
}

/**
 * Registra (o corrige) el valor del pago de una evaluación de Pares ya
 * realizada. Requiere que el par ya tenga un registro de datos bancarios
 * (aunque sea solo con los documentos, sin texto) — el pago queda vinculado
 * a ESE registro, así que sin él no hay a qué cuenta asociarlo.
 *
 * Todavía NO queda marcado como "pagado" para el par evaluador: eso solo
 * pasa cuando se adjunta el comprobante (ver guardarComprobantePago) — sin
 * comprobante no hay con qué respaldarle al par que el pago realmente se hizo.
 */
export async function registrarPago(id_evaluacion: number, valor_pago: number, registrado_por: number) {
  const evaluacion = await prisma.evaluacionEtapa.findUnique({ where: { id_evaluacion } });
  if (!evaluacion) throw new EvaluacionNoEncontradaError();

  const datoBancario = await prisma.datoBancarioPar.findFirst({
    where: { id_usuario: evaluacion.evaluado_por },
    orderBy: { id_dato_bancario: "desc" },
  });
  if (!datoBancario) throw new DatosBancariosRequeridosError();

  const existente = await prisma.pagoPar.findFirst({ where: { id_evaluacion }, orderBy: { id_pago: "desc" } });
  const data = {
    id_dato_bancario: datoBancario.id_dato_bancario,
    registrado_por,
    valor_pago,
    pagado: Boolean(existente?.comprobante_pago),
    fecha_pago: new Date(),
  };

  if (existente) {
    return prisma.pagoPar.update({ where: { id_pago: existente.id_pago }, data });
  }
  return prisma.pagoPar.create({ data: { id_evaluacion, ...data } });
}

/**
 * Adjunta (o reemplaza) el comprobante de un pago ya registrado. Es este
 * paso, y no "Registrar pago", el que marca `pagado: true` — así el par
 * evaluador solo ve "Pagado" cuando ya hay un comprobante que lo respalde.
 */
export async function guardarComprobantePago(id_pago: number, nombreArchivo: string) {
  const existente = await prisma.pagoPar.findUnique({ where: { id_pago } });
  if (!existente) throw new PagoNoEncontradoError();
  return prisma.pagoPar.update({ where: { id_pago }, data: { comprobante_pago: nombreArchivo, pagado: true } });
}

/** Ruta en disco del comprobante de cualquier pago (vista Administrador, sin acotar por dueño). */
export async function obtenerRutaComprobante(id_pago: number): Promise<string> {
  const pago = await prisma.pagoPar.findUnique({ where: { id_pago } });
  if (!pago?.comprobante_pago) throw new DocumentoPagoNoEncontradoError();
  return pago.comprobante_pago;
}

export class ComprobanteRequeridoError extends Error {
  constructor() {
    super("Registra el comprobante de pago antes de poder enviar el correo de agradecimiento");
  }
}

export class CertificadoRequeridoError extends Error {
  constructor() {
    super("Carga el certificado de participación en PDF antes de poder enviar el correo de agradecimiento");
  }
}

/** Adjunta (o reemplaza) el certificado de participación de un pago ya registrado. */
export async function guardarCertificadoPago(id_pago: number, nombreArchivo: string) {
  const existente = await prisma.pagoPar.findUnique({ where: { id_pago } });
  if (!existente) throw new PagoNoEncontradoError();
  return prisma.pagoPar.update({ where: { id_pago }, data: { certificado_path: nombreArchivo } });
}

/** Ruta en disco del certificado de un pago (vista Administrador). */
export async function obtenerRutaCertificado(id_pago: number): Promise<string> {
  const pago = await prisma.pagoPar.findUnique({ where: { id_pago } });
  if (!pago?.certificado_path) throw new DocumentoPagoNoEncontradoError();
  return pago.certificado_path;
}

/**
 * Envía el correo de agradecimiento (carta institucional + certificado
 * adjunto) al par evaluador dueño de este pago. Exige que ya tenga
 * comprobante de pago Y certificado cargados — sin eso no hay nada que
 * confirmar ni que adjuntar. El nombre de la convocatoria se toma del
 * proyecto que evaluó (nunca se escribe a mano), así que si mañana hay más
 * de una convocatoria activa, cada correo sigue mencionando la que
 * corresponde a ESE proyecto.
 */
export async function enviarAgradecimientoPago(id_pago: number): Promise<void> {
  const pago = await prisma.pagoPar.findUnique({
    where: { id_pago },
    include: {
      evaluacion: {
        include: {
          proyecto: { include: { convocatoria: true } },
          evaluadoPor: { select: { correo: true } },
        },
      },
    },
  });
  if (!pago) throw new PagoNoEncontradoError();
  if (!pago.comprobante_pago) throw new ComprobanteRequeridoError();
  if (!pago.certificado_path) throw new CertificadoRequeridoError();

  const rutaCertificado = path.join(CARPETA_UPLOADS, pago.certificado_path);
  await enviarCorreoAgradecimientoPar(
    pago.evaluacion.evaluadoPor.correo,
    pago.evaluacion.proyecto.convocatoria.nombre,
    rutaCertificado
  );

  await prisma.pagoPar.update({ where: { id_pago }, data: { fecha_agradecimiento: new Date() } });
}
