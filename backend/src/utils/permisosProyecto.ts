import { prisma } from "../config/prisma";

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

export class NoAutorizadoProyectoError extends Error {
  constructor() {
    super("Solo el creador del proyecto o un administrador pueden gestionar esta información");
  }
}

/**
 * Estados en los que el DUEÑO (el investigador) puede editar su proyecto: mientras espera firmas o el visto bueno del líder, y
 * cuando hay que corregirlo (rechazado o con correcciones). Pasado el visto bueno del líder ya no edita por su cuenta. El
 * Administrador puede en cualquier estado.
 */
export const ESTADOS_EDITABLES_POR_EL_DUENO = ["pendiente_firmas", "pendiente_lider", "rechazado", "no_cumple", "aprobado_con_correcciones"];

/** Es un NoAutorizadoProyectoError, así que los controladores que ya lo manejan lo responden como 403 sin cambios. */
export class ProyectoNoEditableError extends NoAutorizadoProyectoError {
  constructor() {
    super();
    this.message =
      "El proyecto ya no se puede editar: el líder ya dio el visto bueno. Si requiere correcciones, se piden por la notificación.";
  }
}

/**
 * Usado por todos los sub-recursos del proyecto (participantes, áreas,
 * programas, financiación, grupos): solo el dueño del proyecto o un
 * Administrador pueden agregar/editar/quitar información asociada, y el dueño
 * solo en los estados de ESTADOS_EDITABLES_POR_EL_DUENO.
 */
export async function verificarPermisoProyecto(
  id_proyecto: number,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
): Promise<void> {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const esDueno = proyecto.creado_por === usuarioQueEdita.id_usuario;
  const esAdmin = usuarioQueEdita.roles.includes("Administrador");
  if (!esDueno && !esAdmin) throw new NoAutorizadoProyectoError();
  if (!esAdmin && !ESTADOS_EDITABLES_POR_EL_DUENO.includes(proyecto.estado_actual)) throw new ProyectoNoEditableError();
}
