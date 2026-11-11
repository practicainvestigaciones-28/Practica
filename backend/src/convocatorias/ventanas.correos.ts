import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { enviarAvisoSeguimiento } from "../auth/email.service";
import { ROL_ADMINISTRADOR } from "../notificaciones/notificaciones.service";
import { FASES_VENTANA, NOMBRE_FASE, type FaseVentana } from "./convocatoria-ventanas.service";

/**
 * Correos de los plazos de revisión. Para no saturar: uno al abrir la fase, recordatorios espaciados (3 días, 1 día y 4 horas
 * antes del cierre) solo a quien aún tiene algo pendiente, y uno al cerrar solo para los Administradores. Cada correo se manda
 * una sola vez por persona y fase, y todo lo que le toque a una persona en un mismo momento va junto en un solo correo.
 */

const HORA_MS = 60 * 60 * 1000;
/** De más lejano a más cercano al cierre. */
export const HITOS_RECORDATORIO = [
  { tipo: "recordatorio_3d", horas: 72, texto: "faltan menos de 3 días" },
  { tipo: "recordatorio_1d", horas: 24, texto: "falta menos de 1 día" },
  { tipo: "recordatorio_4h", horas: 4, texto: "faltan menos de 4 horas" },
] as const;

/** Solo se avisa el cierre de plazos que cerraron hace poco: un servidor que estuvo apagado días no manda correos viejos. */
const VIGENCIA_AVISO_CIERRE_MS = 48 * HORA_MS;

/** El recordatorio más urgente que ya corresponde según lo que falta para el cierre (null si aún falta más de 3 días). */
export function hitoVigente(restanteMs: number) {
  let vigente: (typeof HITOS_RECORDATORIO)[number] | null = null;
  for (const h of HITOS_RECORDATORIO) if (restanteMs <= h.horas * HORA_MS) vigente = h;
  return vigente;
}

const formatoFecha = (f: Date) => f.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
const urlApp = () => env.FRONTEND_LOGIN_URL.replace(/\/$/, "");

const NOMBRE_ETAPA_POR_FASE: Record<string, string> = { comite: "Comite_Investigacion", etica: "Etica", pares: "Pares" };

/** Quién tiene algo pendiente en la fase y qué proyectos (título) le faltan. */
async function pendientesPorUsuario(id_convocatoria: number, fase: FaseVentana): Promise<Map<number, string[]>> {
  const mapa = new Map<number, string[]>();
  const agregar = (id: number, titulo: string) => mapa.set(id, [...(mapa.get(id) ?? []), titulo]);

  if (fase === "reclamaciones") {
    const proyectos = await prisma.proyecto.findMany({
      where: { id_convocatoria, estado_actual: { in: ["rechazado", "no_cumple"] }, es_historico: false },
      select: { id_proyecto: true, titulo: true, creado_por: true, reclamaciones: { select: { id_reclamacion: true } } },
    });
    for (const p of proyectos) if (p.reclamaciones.length === 0) agregar(p.creado_por, p.titulo);
    return mapa;
  }
  const asignaciones = await prisma.asignacionRevision.findMany({
    where: { fecha_finalizacion: null, asignado_a: { not: null }, etapa: { nombre: NOMBRE_ETAPA_POR_FASE[fase] }, proyecto: { id_convocatoria } },
    select: { asignado_a: true, proyecto: { select: { titulo: true } } },
  });
  for (const a of asignaciones) agregar(a.asignado_a as number, a.proyecto.titulo);
  return mapa;
}

interface LineaCorreo {
  convocatoria: string;
  fase: FaseVentana;
  resumen: string;
  detalle: string;
}

interface Pendiente {
  id_convocatoria: number;
  fase: FaseVentana;
  tipos: string[];
  linea: LineaCorreo;
}

/** Marca como enviados (antes de enviar: mejor perder un correo que repetirlo cada minuto). Devuelve false si ya estaban. */
async function marcar(p: Pendiente, id_usuario: number): Promise<boolean> {
  const { count } = await prisma.avisoCorreoVentana.createMany({
    data: p.tipos.map((tipo) => ({ id_convocatoria: p.id_convocatoria, fase: p.fase, id_usuario, tipo })),
    skipDuplicates: true,
  });
  return count > 0;
}

async function yaEnviado(id_convocatoria: number, fase: string, id_usuario: number, tipo: string): Promise<boolean> {
  return (await prisma.avisoCorreoVentana.count({ where: { id_convocatoria, fase, id_usuario, tipo } })) > 0;
}

export async function procesarCorreosVentanas(ahora: Date = new Date()): Promise<void> {
  if (!env.CORREOS_AVISOS_ACTIVOS) return;

  const porUsuario = new Map<number, Pendiente[]>();
  const agregar = (id: number, p: Pendiente) => porUsuario.set(id, [...(porUsuario.get(id) ?? []), p]);

  // 1) Plazos abiertos: apertura y recordatorios, solo a quien tiene algo pendiente.
  const abiertas = await prisma.convocatoriaVentana.findMany({
    where: { abre_en: { lte: ahora }, cierra_en: { gt: ahora } },
    include: { convocatoria: { select: { nombre: true } } },
  });
  for (const v of abiertas) {
    const fase = v.fase as FaseVentana;
    if (!FASES_VENTANA.includes(fase)) continue;
    const hito = hitoVigente(v.cierra_en.getTime() - ahora.getTime());
    const pendientes = await pendientesPorUsuario(v.id_convocatoria, fase);
    for (const [id_usuario, titulos] of pendientes) {
      // Si el plazo es tan corto que apertura y recordatorio coinciden, va solo el recordatorio (marca ambos).
      const tipo = hito ? hito.tipo : "apertura";
      if (await yaEnviado(v.id_convocatoria, v.fase, id_usuario, tipo)) continue;
      // Un recordatorio no se manda si ya se mandó otro más urgente.
      if (hito) {
        const masUrgentes = HITOS_RECORDATORIO.slice(HITOS_RECORDATORIO.findIndex((h) => h.tipo === hito.tipo) + 1);
        if (await prisma.avisoCorreoVentana.count({ where: { id_convocatoria: v.id_convocatoria, fase: v.fase, id_usuario, tipo: { in: masUrgentes.map((h) => h.tipo) } } })) continue;
      }
      agregar(id_usuario, {
        id_convocatoria: v.id_convocatoria,
        fase,
        tipos: hito ? [hito.tipo, "apertura"] : ["apertura"],
        linea: {
          convocatoria: v.convocatoria.nombre,
          fase,
          resumen: hito
            ? `${NOMBRE_FASE[fase]}: ${hito.texto} para el cierre (${formatoFecha(v.cierra_en)}).`
            : `${NOMBRE_FASE[fase]}: ya está habilitado hasta el ${formatoFecha(v.cierra_en)}.`,
          detalle: titulos.join("; "),
        },
      });
    }
  }

  // 2) Plazos que cerraron hace poco: un correo a cada Administrador con lo que quedó sin revisar.
  const cerradas = await prisma.convocatoriaVentana.findMany({
    where: { cierra_en: { lte: ahora, gte: new Date(ahora.getTime() - VIGENCIA_AVISO_CIERRE_MS) }, reabierta: false },
    include: { convocatoria: { select: { nombre: true } } },
  });
  if (cerradas.length > 0) {
    const administradores = await prisma.usuario.findMany({
      where: { activo: true, roles: { some: { rol: { nombre: ROL_ADMINISTRADOR } } } },
      select: { id_usuario: true },
    });
    for (const v of cerradas) {
      const fase = v.fase as FaseVentana;
      if (!FASES_VENTANA.includes(fase)) continue;
      const pendientes = await pendientesPorUsuario(v.id_convocatoria, fase);
      const total = [...pendientes.values()].reduce((n, t) => n + t.length, 0);
      for (const admin of administradores) {
        if (await yaEnviado(v.id_convocatoria, v.fase, admin.id_usuario, "cierre")) continue;
        agregar(admin.id_usuario, {
          id_convocatoria: v.id_convocatoria,
          fase,
          tipos: ["cierre"],
          linea: {
            convocatoria: v.convocatoria.nombre,
            fase,
            resumen: `Cerró el plazo de ${NOMBRE_FASE[fase]} (${formatoFecha(v.cierra_en)}). ${total === 0 ? "No quedó nada pendiente." : `Quedan ${total} sin atender.`} Puedes reabrirlo desde la convocatoria.`,
            detalle: [...new Set([...pendientes.values()].flat())].slice(0, 15).join("; "),
          },
        });
      }
    }
  }

  if (porUsuario.size === 0) return;
  const usuarios = await prisma.usuario.findMany({
    where: { id_usuario: { in: [...porUsuario.keys()] }, activo: true },
    select: { id_usuario: true, nombre: true, apellido: true, correo: true },
  });

  // 3) Un solo correo por persona con todo lo que le toca en este momento.
  for (const u of usuarios) {
    const pendientes = porUsuario.get(u.id_usuario) ?? [];
    const nuevos: Pendiente[] = [];
    for (const p of pendientes) if (await marcar(p, u.id_usuario)) nuevos.push(p);
    if (nuevos.length === 0) continue;

    const filas: [string, string][] = nuevos.flatMap((p) => {
      const f: [string, string][] = [[`${p.linea.convocatoria}`, p.linea.resumen]];
      if (p.linea.detalle) f.push(["Proyectos", p.linea.detalle]);
      return f;
    });
    // Al correo con el que inicia sesión: el correo personal de la hoja de vida es solo para las firmas.
    const destino = u.correo;
    const asunto =
      nuevos.length === 1
        ? `${nuevos[0].tipos[0] === "cierre" ? "Cerró" : "Plazo de"} ${NOMBRE_FASE[nuevos[0].fase]} — ${nuevos[0].linea.convocatoria}`
        : `Tienes ${nuevos.length} plazos de revisión en SGP-VIE`;
    try {
      await enviarAvisoSeguimiento(
        destino,
        `${u.nombre} ${u.apellido}`.trim(),
        asunto,
        nuevos.length === 1 ? "Un plazo de revisión del sistema requiere tu atención." : "Estos plazos de revisión del sistema requieren tu atención.",
        filas,
        "Ir al sistema",
        urlApp()
      );
    } catch (error) {
      console.error(`No se pudo enviar el correo del plazo de revisión a ${destino}:`, error);
    }
  }
}
