import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import type { ParametrosPaginacion } from "../utils/paginacion";

export class ConvocatoriaNoEncontradaError extends Error {
  constructor() {
    super("La convocatoria no existe");
  }
}

export class ConvocatoriaCerradaError extends Error {
  constructor() {
    super("No se pueden registrar proyectos en una convocatoria que no está activa");
  }
}

/**
 * El campo `estado` de la convocatoria es manual (lo cambia el Administrador
 * con el switch) y nada lo mueve automáticamente cuando pasa `fecha_fin` — no
 * hay ningún job que la cierre sola. Sin esta validación, una convocatoria
 * vencida seguía aceptando proyectos nuevos mientras nadie la desactivara a
 * mano.
 */
export class ConvocatoriaVencidaError extends Error {
  constructor() {
    super("La convocatoria está fuera de su periodo de vigencia");
  }
}

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

export class NoAutorizadoError extends Error {
  constructor() {
    super("Solo el creador del proyecto o un administrador pueden editarlo");
  }
}

/**
 * El investigador debe completar el formulario general del proyecto antes de
 * poder guardar (crear o editar): ya no se acepta un borrador con campos
 * vueltos null/vacíos a mitad de camino, para que Comité no reciba proyectos
 * con información faltante en esta parte del registro.
 */
export class CamposIncompletosError extends Error {
  constructor(public readonly faltantes: string[]) {
    super(`Faltan campos obligatorios: ${faltantes.join(", ")}`);
  }
}

export interface DatosProyecto {
  id_convocatoria: number;
  id_modalidad_proyecto: number;
  id_tipo_proyecto: number;
  titulo: string;
  ciudad: string;
  departamento: string;
  resumen: string;
  planteamiento_problema: string;
  pregunta_investigacion: string;
  justificacion: string;
  marco_teorico: string;
  metodologia_preliminar: string;
  componente_etico: string;
  funciones_estudiante_auxiliar: string;
  duracion_periodos: number;
}

const CAMPOS_TEXTO_OBLIGATORIOS = [
  "titulo",
  "ciudad",
  "departamento",
  "resumen",
  "planteamiento_problema",
  "pregunta_investigacion",
  "justificacion",
  "marco_teorico",
  "metodologia_preliminar",
  "componente_etico",
  "funciones_estudiante_auxiliar",
] as const;

/** Todos los campos del formulario general son obligatorios: ningún texto vacío y duracion_periodos presente. */
function validarCamposCompletos(datos: Partial<DatosProyecto>): void {
  const faltantes: string[] = [];
  for (const campo of CAMPOS_TEXTO_OBLIGATORIOS) {
    const valor = datos[campo];
    if (typeof valor !== "string" || valor.trim() === "") faltantes.push(campo);
  }
  if (datos.duracion_periodos === undefined || datos.duracion_periodos === null) {
    faltantes.push("duracion_periodos");
  }
  if (faltantes.length > 0) throw new CamposIncompletosError(faltantes);
}

/** RQF13 - Registro de proyecto por investigador */
export async function crearProyecto(datos: DatosProyecto, creado_por: number) {
  validarCamposCompletos(datos);

  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id_convocatoria: datos.id_convocatoria },
  });

  if (!convocatoria) throw new ConvocatoriaNoEncontradaError();
  if (convocatoria.estado !== "activa") throw new ConvocatoriaCerradaError();

  const ahora = new Date();
  if (ahora < convocatoria.fecha_inicio || ahora > convocatoria.fecha_fin) {
    throw new ConvocatoriaVencidaError();
  }

  return prisma.proyecto.create({
    data: { ...datos, creado_por },
  });
}

/**
 * RQF15 / RQF75 - Consulta y listado de proyectos, con filtros, búsqueda y
 * paginación (RNF02/RNF07 - no cargar el listado completo de una vez).
 */
export async function listarProyectos(
  filtros: { estado?: string; id_convocatoria?: number; q?: string },
  paginacion: ParametrosPaginacion
) {
  const where: Prisma.ProyectoWhereInput = {
    ...(filtros.estado ? { estado_actual: filtros.estado } : {}),
    ...(filtros.id_convocatoria ? { id_convocatoria: filtros.id_convocatoria } : {}),
    ...(filtros.q ? { titulo: { contains: filtros.q, mode: "insensitive" } } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.proyecto.count({ where }),
    prisma.proyecto.findMany({
      where,
      include: {
        convocatoria: { select: { nombre: true } },
        modalidad: { select: { nombre: true } },
        tipoProyecto: { select: { nombre: true } },
        creador: { select: { id_usuario: true, nombre: true, apellido: true } },
      },
      orderBy: { fecha_registro: "desc" },
      skip: paginacion.skip,
      take: paginacion.limit,
    }),
  ]);

  return { data, total };
}

/** RQF15 - Consulta de detalle */
export async function obtenerProyecto(id_proyecto: number) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    include: {
      convocatoria: true,
      modalidad: true,
      tipoProyecto: true,
      creador: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } },
    },
  });

  if (!proyecto) throw new ProyectoNoEncontradoError();
  return proyecto;
}

const CAMPOS_EDITABLES = [
  ...CAMPOS_TEXTO_OBLIGATORIOS,
  "duracion_periodos",
  "id_modalidad_proyecto",
  "id_tipo_proyecto",
] as const;

/**
 * RQF14 - Edición del proyecto según etapa. Ya no es un update parcial: cada
 * PUT debe traer el formulario general completo (mismo criterio que al
 * crear), así que si se omite o se vacía un campo obligatorio se rechaza
 * antes de tocar la BD, en vez de dejar guardar un campo en null a mitad de
 * camino. La restricción fina por etapa/estado se ampliará cuando se modele
 * el flujo de evaluación.
 */
export async function actualizarProyecto(
  id_proyecto: number,
  cambios: Pick<DatosProyecto, (typeof CAMPOS_EDITABLES)[number]>,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  const existente = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!existente) throw new ProyectoNoEncontradoError();

  const esDueno = existente.creado_por === usuarioQueEdita.id_usuario;
  const esAdmin = usuarioQueEdita.roles.includes("Administrador");
  if (!esDueno && !esAdmin) throw new NoAutorizadoError();

  validarCamposCompletos(cambios);
  if (!cambios.id_modalidad_proyecto || !cambios.id_tipo_proyecto) {
    throw new CamposIncompletosError(["id_modalidad_proyecto", "id_tipo_proyecto"].filter((c) => !cambios[c as keyof typeof cambios]));
  }

  const data: Record<string, string | number> = {};
  for (const campo of CAMPOS_EDITABLES) {
    data[campo] = cambios[campo];
  }

  // Si el dueño corrige un proyecto rechazado en la revisión inicial, el
  // reenvío debe volver a ponerlo en la bandeja de Postulados — si no,
  // quedaría "rechazado" para siempre aunque ya se hayan corregido los
  // campos que motivaron el rechazo.
  if (esDueno && existente.estado_actual === "rechazado") {
    const etapaInicial = await prisma.etapa.findUnique({ where: { nombre: "General/Inicial" } });
    const estadoPendiente = await prisma.estado.findUnique({ where: { nombre: "pendiente" } });

    const [actualizado] = await prisma.$transaction([
      prisma.proyecto.update({ where: { id_proyecto }, data: { ...data, estado_actual: "pendiente" } }),
      ...(etapaInicial && estadoPendiente
        ? [
            prisma.historialEtapaEstado.create({
              data: {
                id_proyecto,
                id_etapa: etapaInicial.id_etapa,
                id_estados: estadoPendiente.id_estado,
                cambiado_por: usuarioQueEdita.id_usuario,
                observacion: "El investigador corrigió el proyecto y lo reenvió para revisión.",
              },
            }),
          ]
        : []),
    ]);
    return actualizado;
  }

  return prisma.proyecto.update({ where: { id_proyecto }, data });
}
