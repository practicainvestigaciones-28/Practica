import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import type { ParametrosPaginacion } from "../utils/paginacion";
import { crearNotificacion, resolverNotificaciones, TIPO_NOTIFICACION } from "../notificaciones/notificaciones.service";

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

/** Eliminar, a diferencia de editar, es exclusivo del Investigador(a) Principal — ni siquiera Administrador. */
export class NoPropietarioError extends Error {
  constructor() {
    super("Solo el Investigador(a) Principal que creó este proyecto puede eliminarlo");
  }
}

/**
 * Antes de que el líder del grupo dé su visto bueno (estado_actual en
 * "pendiente_firmas" o "pendiente_lider"), o si lo rechazó ("rechazado"), el
 * proyecto todavía no entró a ningún flujo institucional de evaluación — se
 * puede eliminar sin dejar nada a medias. Una vez el líder lo aprueba
 * (estado_actual avanza a "pendiente" o más allá), ya no.
 */
const ESTADOS_PROYECTO_ELIMINABLE = ["pendiente_firmas", "pendiente_lider", "rechazado"];

export class ProyectoNoEliminableError extends Error {
  constructor() {
    super("Este proyecto ya tiene el visto bueno del líder y no se puede eliminar");
  }
}

/** Al asignar un responsable distinto de quien crea el proyecto (carga desde Word por un Administrador). */
export class ResponsableNoEncontradoError extends Error {
  constructor() {
    super("El usuario indicado como responsable del proyecto no existe");
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
  implicaciones_eticas?: string;
  fuentes_financiacion?: string;
  permisos_licencias?: string;
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

// Implicaciones éticas, fuentes de financiación y permisos/licencias son
// parte del Componente ético pero, a diferencia del resto, no son
// obligatorios (el formato oficial los marca como "si son necesarias").
const CAMPOS_TEXTO_OPCIONALES = [
  "implicaciones_eticas",
  "fuentes_financiacion",
  "permisos_licencias",
] as const;

/** Todos los campos del formulario general son obligatorios: ningún texto vacío y duracion_periodos presente. */
function validarCamposCompletos(datos: Partial<DatosProyecto>): void {
  const faltantes: string[] = [];
  for (const campo of CAMPOS_TEXTO_OBLIGATORIOS) {
    const valor = datos[campo];
    if (typeof valor !== "string" || valor.trim() === "") faltantes.push(campo);
  }
  // No basta con "presente": si no es un entero positivo, Prisma lo rechazaría
  // más abajo con un PrismaClientValidationError sin controlar (500), en vez
  // de este 400 explícito.
  if (
    datos.duracion_periodos === undefined ||
    datos.duracion_periodos === null ||
    typeof datos.duracion_periodos !== "number" ||
    !Number.isInteger(datos.duracion_periodos) ||
    datos.duracion_periodos <= 0
  ) {
    faltantes.push("duracion_periodos");
  }
  if (faltantes.length > 0) throw new CamposIncompletosError(faltantes);
}

/**
 * RQF13 - Registro de proyecto por investigador.
 *
 * `idResponsableAsignado` solo lo usa el Administrador al cargar un proyecto
 * desde el documento Word de otra persona: sin esto, el proyecto quedaría
 * registrado como creado por el Administrador en vez de por el investigador
 * real. El controlador ya valida que solo un Administrador pueda enviarlo.
 */
export async function crearProyecto(datos: DatosProyecto, creado_por: number, idResponsableAsignado?: number) {
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

  let creadoPorFinal = creado_por;
  if (idResponsableAsignado !== undefined) {
    const responsable = await prisma.usuario.findUnique({ where: { id_usuario: idResponsableAsignado } });
    if (!responsable) throw new ResponsableNoEncontradoError();
    creadoPorFinal = idResponsableAsignado;
  }

  // Nace esperando firmas: solo pasa al líder cuando el Principal lo guarda
  // con todas las firmas obligatorias (ver finalizarFirmas en firmas-proyecto).
  return prisma.proyecto.create({
    data: { ...datos, creado_por: creadoPorFinal, estado_actual: "pendiente_firmas" },
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
  ...CAMPOS_TEXTO_OPCIONALES,
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

  const data: Record<string, string | number | undefined> = {};
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

    const administradores = await prisma.usuario.findMany({
      where: { activo: true, roles: { some: { rol: { nombre: "Administrador" } } } },
      select: { id_usuario: true },
    });
    await Promise.all(
      administradores.map((admin) =>
        crearNotificacion(admin.id_usuario, {
          titulo: "Proyecto corregido",
          mensaje: `El investigador corrigió el proyecto "${actualizado.titulo}" (antes rechazado) y lo reenvió — queda pendiente de revisión en Proyectos Postulados.`,
          enlace: "/proyectos?tab=postulados",
          rol_destino: "Administrador",
          tipo_evento: TIPO_NOTIFICACION.ADMIN_REVISAR_POSTULADO,
          id_proyecto,
        })
      )
    );
    await resolverNotificaciones(id_proyecto, [TIPO_NOTIFICACION.INVESTIGADOR_CORREGIR]);

    return actualizado;
  }

  return prisma.proyecto.update({ where: { id_proyecto }, data });
}

/**
 * Elimina el proyecto por completo. Solo el Investigador(a) Principal que lo
 * creó puede hacerlo (ver NoPropietarioError), y solo mientras el líder no le
 * haya dado el visto bueno (ver ESTADOS_PROYECTO_ELIMINABLE /
 * ProyectoNoEliminableError). El esquema ya cascada limpio a todo lo
 * dependiente (participantes, grupos, actas, firmas, documentos,
 * evaluaciones...), así que un delete directo alcanza.
 */
export async function eliminarProyecto(
  id_proyecto: number,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  const existente = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!existente) throw new ProyectoNoEncontradoError();

  if (existente.creado_por !== usuarioQueEdita.id_usuario) throw new NoPropietarioError();
  if (!ESTADOS_PROYECTO_ELIMINABLE.includes(existente.estado_actual)) throw new ProyectoNoEliminableError();

  await prisma.proyecto.delete({ where: { id_proyecto } });
}
