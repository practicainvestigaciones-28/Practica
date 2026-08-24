import { prisma } from "../config/prisma";

export interface ConteoPorEstado {
  estado: string;
  cantidad: number;
}

export interface ProyectoReciente {
  id_proyecto: number;
  titulo: string;
  estado_actual: string;
  fecha_registro: Date;
  convocatoria: string;
  creador: string;
}

export interface EstadisticasDashboard {
  totalProyectos: number;
  proyectosPorEstado: ConteoPorEstado[];
  totalConvocatorias: number;
  convocatoriasActivas: number;
  totalUsuarios: number;
  proyectosRecientes: ProyectoReciente[];
}

interface UsuarioActual {
  id_usuario: number;
  roles: string[];
}

const LIMITE_RECIENTES = 5;

/**
 * RQF73 - Calcular estadísticas / consolidar métricas institucionales.
 * RQF74 - Datos que alimentan las gráficas e indicadores del Dashboard.
 * RQF76 - "Según rol": un Administrador ve el panorama institucional
 * completo; cualquier otro rol (por ahora, Investigador) ve solo sus
 * propios proyectos, como "proyectos asignados".
 */
export async function obtenerEstadisticas(usuario: UsuarioActual): Promise<EstadisticasDashboard> {
  const esAdmin = usuario.roles.includes("Administrador");

  // Filtro base: el administrador ve todo; cualquier otro rol solo lo suyo.
  const filtroProyectos = esAdmin ? {} : { creado_por: usuario.id_usuario };

  const [totalProyectos, agrupadoPorEstado, proyectosRecientesRaw, totalConvocatorias, convocatoriasActivas, totalUsuarios] =
    await Promise.all([
      prisma.proyecto.count({ where: filtroProyectos }),

      prisma.proyecto.groupBy({
        by: ["estado_actual"],
        where: filtroProyectos,
        _count: { _all: true },
      }),

      prisma.proyecto.findMany({
        where: filtroProyectos,
        orderBy: { fecha_registro: "desc" },
        take: LIMITE_RECIENTES,
        include: {
          convocatoria: { select: { nombre: true } },
          creador: { select: { nombre: true, apellido: true } },
        },
      }),

      // Los totales institucionales de convocatorias/usuarios solo tienen
      // sentido para el panel de administrador; para otros roles van en 0
      // (el frontend puede simplemente no mostrar esas tarjetas).
      esAdmin ? prisma.convocatoria.count() : Promise.resolve(0),
      esAdmin ? prisma.convocatoria.count({ where: { estado: "activa" } }) : Promise.resolve(0),
      esAdmin ? prisma.usuario.count() : Promise.resolve(0),
    ]);

  const proyectosPorEstado: ConteoPorEstado[] = agrupadoPorEstado.map((grupo) => ({
    estado: grupo.estado_actual,
    cantidad: grupo._count._all,
  }));

  const proyectosRecientes: ProyectoReciente[] = proyectosRecientesRaw.map((p) => ({
    id_proyecto: p.id_proyecto,
    titulo: p.titulo,
    estado_actual: p.estado_actual,
    fecha_registro: p.fecha_registro,
    convocatoria: p.convocatoria.nombre,
    creador: `${p.creador.nombre} ${p.creador.apellido}`,
  }));

  return {
    totalProyectos,
    proyectosPorEstado,
    totalConvocatorias,
    convocatoriasActivas,
    totalUsuarios,
    proyectosRecientes,
  };
}
