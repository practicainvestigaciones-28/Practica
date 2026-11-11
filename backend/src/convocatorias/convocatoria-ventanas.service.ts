import { prisma } from "../config/prisma";

/**
 * Plazos de revisión de una convocatoria. Las fases son secuenciales, en este orden: cada una abre después de que cierra la
 * anterior, y la primera después del cierre de la convocatoria.
 */
export const FASES_VENTANA = ["comite", "etica", "pares", "reclamaciones"] as const;
export type FaseVentana = (typeof FASES_VENTANA)[number];

export const NOMBRE_FASE: Record<FaseVentana, string> = {
  comite: "Comité de Investigación",
  etica: "Comité de Ética",
  pares: "Pares evaluadores",
  reclamaciones: "Reclamaciones",
};

/** Etapa de evaluación (catálogo `Etapa`) que corresponde a cada fase de revisión. Reclamaciones no es una etapa. */
export const FASE_POR_ETAPA: Record<string, FaseVentana> = {
  Comite_Investigacion: "comite",
  Etica: "etica",
  Pares: "pares",
};

export class ConvocatoriaNoEncontradaError extends Error {
  constructor() {
    super("La convocatoria no existe");
  }
}

export class VentanaInvalidaError extends Error {}

export class VentanaNoEncontradaError extends Error {
  constructor() {
    super("Esa fase no tiene plazo definido en la convocatoria");
  }
}

/** La fase no está abierta: fuera del plazo y sin reapertura del Administrador. Los controladores la responden como 403. */
export class VentanaCerradaError extends Error {
  constructor(fase: FaseVentana, abre_en: Date, cierra_en: Date) {
    const formato = (f: Date) => f.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
    const ahora = new Date();
    super(
      ahora < abre_en
        ? `${NOMBRE_FASE[fase]} aún no está habilitada: abre el ${formato(abre_en)}.`
        : `El plazo de ${NOMBRE_FASE[fase]} cerró el ${formato(cierra_en)}. El Administrador puede reabrirlo.`
    );
  }
}

export interface EntradaVentana {
  fase: string;
  abre_en: Date;
  cierra_en: Date;
}

interface VentanaBasica {
  abre_en: Date;
  cierra_en: Date;
  reabierta: boolean;
}

/** Abierta dentro de su plazo, o mientras el Administrador la tenga reabierta a mano. */
export function estaAbierta(v: VentanaBasica, ahora: Date = new Date()): boolean {
  return v.reabierta || (ahora >= v.abre_en && ahora <= v.cierra_en);
}

/**
 * Reglas de los plazos: fases conocidas y sin repetir, cada una con cierre posterior a su apertura, en orden secuencial
 * (cada fase abre después de que cierra la anterior) y la primera después del cierre de la convocatoria. Lanza
 * VentanaInvalidaError con el mensaje a mostrar. Devuelve las ventanas ordenadas por fase.
 */
export function validarVentanas(entradas: EntradaVentana[], fin_convocatoria: Date): EntradaVentana[] {
  const vistas = new Set<string>();
  for (const e of entradas) {
    if (!FASES_VENTANA.includes(e.fase as FaseVentana)) throw new VentanaInvalidaError(`La fase "${e.fase}" no existe`);
    if (vistas.has(e.fase)) throw new VentanaInvalidaError(`La fase "${NOMBRE_FASE[e.fase as FaseVentana]}" está repetida`);
    vistas.add(e.fase);
    if (!(e.abre_en instanceof Date) || Number.isNaN(e.abre_en.getTime()) || !(e.cierra_en instanceof Date) || Number.isNaN(e.cierra_en.getTime())) {
      throw new VentanaInvalidaError(`Fechas inválidas en ${NOMBRE_FASE[e.fase as FaseVentana]}`);
    }
    if (e.cierra_en <= e.abre_en) {
      throw new VentanaInvalidaError(`${NOMBRE_FASE[e.fase as FaseVentana]}: el cierre debe ser posterior a la apertura`);
    }
  }

  const ordenadas = [...entradas].sort((a, b) => FASES_VENTANA.indexOf(a.fase as FaseVentana) - FASES_VENTANA.indexOf(b.fase as FaseVentana));
  let anterior: { nombre: string; fin: Date } = { nombre: "del cierre de la convocatoria", fin: fin_convocatoria };
  for (const e of ordenadas) {
    if (e.abre_en < anterior.fin) {
      throw new VentanaInvalidaError(`${NOMBRE_FASE[e.fase as FaseVentana]} debe abrir después ${anterior.nombre}`);
    }
    anterior = { nombre: `del cierre de ${NOMBRE_FASE[e.fase as FaseVentana]}`, fin: e.cierra_en };
  }
  return ordenadas;
}

function conEstado<T extends VentanaBasica & { fase: string }>(v: T, ahora: Date) {
  const abierta = estaAbierta(v, ahora);
  const estado = v.reabierta ? "reabierta" : ahora < v.abre_en ? "programada" : ahora <= v.cierra_en ? "abierta" : "cerrada";
  return { ...v, abierta, estado };
}

async function exigirConvocatoria(id_convocatoria: number) {
  const convocatoria = await prisma.convocatoria.findUnique({ where: { id_convocatoria } });
  if (!convocatoria) throw new ConvocatoriaNoEncontradaError();
  return convocatoria;
}

/** Plazos de la convocatoria, en el orden de las fases, con su estado actual (programada, abierta, reabierta, cerrada). */
export async function obtenerVentanas(id_convocatoria: number) {
  await exigirConvocatoria(id_convocatoria);
  const filas = await prisma.convocatoriaVentana.findMany({ where: { id_convocatoria } });
  const ahora = new Date();
  return filas
    .sort((a, b) => FASES_VENTANA.indexOf(a.fase as FaseVentana) - FASES_VENTANA.indexOf(b.fase as FaseVentana))
    .map((v) => conEstado(v, ahora));
}

/**
 * Reemplaza los plazos de la convocatoria por los recibidos (las fases que no vengan quedan sin restricción). Si una fase
 * cambia de fechas se vuelve a avisar su apertura/cierre; si no cambió, conserva lo que ya llevaba.
 */
export async function guardarVentanas(id_convocatoria: number, entradas: EntradaVentana[], definido_por: number) {
  const convocatoria = await exigirConvocatoria(id_convocatoria);
  const ordenadas = validarVentanas(entradas, convocatoria.fecha_fin);

  const actuales = await prisma.convocatoriaVentana.findMany({ where: { id_convocatoria } });
  const porFase = new Map(actuales.map((v) => [v.fase, v]));

  await prisma.$transaction([
    prisma.convocatoriaVentana.deleteMany({ where: { id_convocatoria, fase: { notIn: ordenadas.map((e) => e.fase) } } }),
    ...ordenadas.flatMap((e) => {
      const previa = porFase.get(e.fase);
      const cambioApertura = !previa || previa.abre_en.getTime() !== e.abre_en.getTime();
      const cambioCierre = !previa || previa.cierra_en.getTime() !== e.cierra_en.getTime();
      // Con fechas nuevas se vuelven a mandar los correos de esa fase.
      const reiniciarCorreos = previa && (cambioApertura || cambioCierre) ? [prisma.avisoCorreoVentana.deleteMany({ where: { id_convocatoria, fase: e.fase } })] : [];
      const guardar = prisma.convocatoriaVentana.upsert({
        where: { id_convocatoria_fase: { id_convocatoria, fase: e.fase } },
        create: { id_convocatoria, fase: e.fase, abre_en: e.abre_en, cierra_en: e.cierra_en, definido_por },
        update: {
          abre_en: e.abre_en,
          cierra_en: e.cierra_en,
          definido_por,
          ...(cambioApertura ? { avisado_apertura: false } : {}),
          ...(cambioCierre ? { avisado_cierre: false } : {}),
        },
      });
      return [...reiniciarCorreos, guardar];
    }),
  ]);
  return obtenerVentanas(id_convocatoria);
}

async function cambiarReapertura(id_convocatoria: number, fase: string, reabierta: boolean) {
  await exigirConvocatoria(id_convocatoria);
  const existente = await prisma.convocatoriaVentana.findUnique({ where: { id_convocatoria_fase: { id_convocatoria, fase } } });
  if (!existente) throw new VentanaNoEncontradaError();
  await prisma.convocatoriaVentana.update({
    where: { id_convocatoria_fase: { id_convocatoria, fase } },
    data: { reabierta },
  });
  return obtenerVentanas(id_convocatoria);
}

/** El Administrador reabre la fase mientras se hace una edición, sin tocar las fechas. Se cierra de nuevo con cerrarVentana. */
export function reabrirVentana(id_convocatoria: number, fase: string) {
  return cambiarReapertura(id_convocatoria, fase, true);
}

/** Termina la reapertura: la fase vuelve a regirse por sus fechas. */
export function cerrarVentana(id_convocatoria: number, fase: string) {
  return cambiarReapertura(id_convocatoria, fase, false);
}

/** Lanza VentanaCerradaError si la convocatoria tiene plazo para la fase y hoy está fuera de él. Sin plazo definido = sin restricción. */
export async function exigirVentanaAbierta(id_convocatoria: number, fase: FaseVentana, ahora: Date = new Date()): Promise<void> {
  const v = await prisma.convocatoriaVentana.findUnique({ where: { id_convocatoria_fase: { id_convocatoria, fase } } });
  if (v && !estaAbierta(v, ahora)) throw new VentanaCerradaError(fase, v.abre_en, v.cierra_en);
}
