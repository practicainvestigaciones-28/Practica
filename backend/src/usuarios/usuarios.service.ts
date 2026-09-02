import { prisma } from "../config/prisma";
import type { ParametrosPaginacion } from "../utils/paginacion";

/**
 * RQF17 (soporte) - Búsqueda de usuarios registrados, para poder asociarlos
 * como participantes reales de un proyecto (en vez de texto libre).
 * Devuelve solo lo mínimo necesario para elegir a la persona correcta.
 */
export async function buscarUsuarios(q: string) {
    const termino = q.trim();
    if (termino.length < 2) return [];

    return prisma.usuario.findMany({
        where: {
            OR: [
                { nombre: { contains: termino, mode: "insensitive" } },
                { apellido: { contains: termino, mode: "insensitive" } },
                { correo: { contains: termino, mode: "insensitive" } },
            ],
        },
        select: {
            id_usuario: true,
            nombre: true,
            apellido: true,
            correo: true,
            cedula: true,
        },
        take: 10,
        orderBy: { nombre: "asc" },
    });
}

/**
 * Listado de usuarios registrados, para el panel de Administrador.
 * Incluye los roles reales de cada uno y cuántos proyectos ha creado.
 * Paginado (RNF02/RNF07) — no se carga la tabla completa de una sola vez.
 */
export async function listarUsuarios(paginacion: ParametrosPaginacion) {
    const [total, usuarios] = await Promise.all([
        prisma.usuario.count(),
        prisma.usuario.findMany({
            include: {
                roles: { include: { rol: true } },
                _count: { select: { proyectosCreados: true } },
            },
            orderBy: { nombre: "asc" },
            skip: paginacion.skip,
            take: paginacion.limit,
        }),
    ]);

    const data = usuarios.map((u) => ({
        id_usuario: u.id_usuario,
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        codigo: u.codigo,
        cedula: u.cedula,
        roles: u.roles.map((ru) => ru.rol.nombre),
        totalProyectos: u._count.proyectosCreados,
    }));

    return { data, total };
}