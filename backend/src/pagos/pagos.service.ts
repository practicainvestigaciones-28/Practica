import { prisma } from "../config/prisma";

export class DatosBancariosInvalidosError extends Error {
  constructor() {
    super("Debes indicar banco, tipo de cuenta, número de cuenta, titular y documento del titular");
  }
}

const TIPOS_CUENTA_VALIDOS = ["ahorros", "corriente"] as const;

export class TipoCuentaInvalidoError extends Error {
  constructor() {
    super(`tipo_cuenta debe ser uno de: ${TIPOS_CUENTA_VALIDOS.join(", ")}`);
  }
}

export interface DatosBancarios {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  documento_titular: string;
}

/** Datos bancarios propios del par evaluador logueado, o null si todavía no los registró. */
export async function obtenerDatosBancariosPropios(id_usuario: number) {
  return prisma.datoBancarioPar.findFirst({
    where: { id_usuario },
    orderBy: { id_dato_bancario: "desc" },
  });
}

/**
 * El par evaluador registra o actualiza sus propios datos bancarios (RQF ad
 * hoc de Información de pagos). Solo se guarda UN registro activo por
 * usuario: si ya existía, se actualiza en vez de duplicar.
 */
export async function guardarDatosBancariosPropios(id_usuario: number, datos: DatosBancarios) {
  const banco = datos.banco?.trim();
  const tipo_cuenta = datos.tipo_cuenta?.trim().toLowerCase();
  const numero_cuenta = datos.numero_cuenta?.trim();
  const titular = datos.titular?.trim();
  const documento_titular = datos.documento_titular?.trim();

  if (!banco || !tipo_cuenta || !numero_cuenta || !titular || !documento_titular) {
    throw new DatosBancariosInvalidosError();
  }
  if (!TIPOS_CUENTA_VALIDOS.includes(tipo_cuenta as (typeof TIPOS_CUENTA_VALIDOS)[number])) {
    throw new TipoCuentaInvalidoError();
  }

  const existente = await prisma.datoBancarioPar.findFirst({
    where: { id_usuario },
    orderBy: { id_dato_bancario: "desc" },
  });

  const data = { banco, tipo_cuenta, numero_cuenta, titular, documento_titular };

  if (existente) {
    return prisma.datoBancarioPar.update({ where: { id_dato_bancario: existente.id_dato_bancario }, data });
  }
  return prisma.datoBancarioPar.create({ data: { id_usuario, ...data } });
}
