import { prisma } from "../config/prisma";
import { hashearContraseña } from "../utils/password";
import type { ParametrosPaginacion } from "../utils/paginacion";

export class UsuarioNoEncontradoError extends Error {
    constructor() {
        super("El usuario no existe");
    }
}

export class CorreoDuplicadoError extends Error {
    constructor() {
        super("Ya existe un usuario registrado con ese correo");
    }
}

export class RolInvalidoError extends Error {
    constructor() {
        super("El rol indicado no existe");
    }
}

/**
 * RQF17 (soporte) - Búsqueda de usuarios registrados, para poder asociarlos
 * como participantes reales de un proyecto (en vez de texto libre).
 * Devuelve solo lo mínimo necesario para elegir a la persona correcta.
 * Solo cuentas activas: una cuenta desactivada no debería poder asignarse
 * como participante nuevo en un proyecto.
 */
export async function buscarUsuarios(q: string) {
    const termino = q.trim();
    if (termino.length < 2) return [];

    return prisma.usuario.findMany({
        where: {
            activo: true,
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

function mapearUsuarioListado(u: {
    id_usuario: number;
    nombre: string;
    apellido: string;
    correo: string;
    codigo: string | null;
    cedula: string | null;
    activo: boolean;
    roles: { rol: { nombre: string } }[];
    _count: { proyectosCreados: number };
}) {
    return {
        id_usuario: u.id_usuario,
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        codigo: u.codigo,
        cedula: u.cedula,
        activo: u.activo,
        roles: u.roles.map((ru) => ru.rol.nombre),
        totalProyectos: u._count.proyectosCreados,
    };
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

    return { data: usuarios.map(mapearUsuarioListado), total };
}

export interface DatosCrearUsuario {
    nombre: string;
    apellido: string;
    correo: string;
    contraseña: string;
    /** Nombre del rol (ej. "Administrador", "Investigador") — el formulario actual maneja un solo rol por usuario */
    rol: string;
    codigo?: string;
    cedula?: string;
}

/** RQF05 - Registrar un nuevo usuario del sistema (solo Administrador, validado en la ruta). */
export async function crearUsuario(datos: DatosCrearUsuario) {
    const correo = datos.correo.toLowerCase().trim();

    const correoExistente = await prisma.usuario.findUnique({ where: { correo } });
    if (correoExistente) throw new CorreoDuplicadoError();

    const rol = await prisma.rol.findUnique({ where: { nombre: datos.rol } });
    if (!rol) throw new RolInvalidoError();

    const contraseñaHash = await hashearContraseña(datos.contraseña);

    const usuario = await prisma.usuario.create({
        data: {
            nombre: datos.nombre,
            apellido: datos.apellido,
            correo,
            contraseña: contraseñaHash,
            codigo: datos.codigo,
            cedula: datos.cedula,
            roles: { create: { id_rol: rol.id_rol } },
        },
        include: {
            roles: { include: { rol: true } },
            _count: { select: { proyectosCreados: true } },
        },
    });

    return mapearUsuarioListado(usuario);
}

export interface DatosActualizarUsuario {
    nombre?: string;
    apellido?: string;
    correo?: string;
    codigo?: string;
    cedula?: string;
    /** Si viene, reemplaza la contraseña actual */
    contraseña?: string;
    /** Si viene, reemplaza el rol actual del usuario por este */
    rol?: string;
}

/** RQF05 - Editar la información de un usuario existente (solo Administrador). */
export async function actualizarUsuario(id_usuario: number, cambios: DatosActualizarUsuario) {
    const existente = await prisma.usuario.findUnique({ where: { id_usuario } });
    if (!existente) throw new UsuarioNoEncontradoError();

    const correoNuevo = cambios.correo?.toLowerCase().trim();
    if (correoNuevo && correoNuevo !== existente.correo) {
        const correoTomado = await prisma.usuario.findUnique({ where: { correo: correoNuevo } });
        if (correoTomado) throw new CorreoDuplicadoError();
    }

    if (cambios.rol) {
        const rol = await prisma.rol.findUnique({ where: { nombre: cambios.rol } });
        if (!rol) throw new RolInvalidoError();

        // El formulario actual maneja un solo rol por usuario: se reemplaza
        // cualquier asignación previa en vez de acumularlas.
        await prisma.rolesUsuario.deleteMany({ where: { id_usuario } });
        await prisma.rolesUsuario.create({ data: { id_usuario, id_rol: rol.id_rol } });
    }

    const usuario = await prisma.usuario.update({
        where: { id_usuario },
        data: {
            nombre: cambios.nombre,
            apellido: cambios.apellido,
            correo: correoNuevo,
            codigo: cambios.codigo,
            cedula: cambios.cedula,
            ...(cambios.contraseña ? { contraseña: await hashearContraseña(cambios.contraseña) } : {}),
        },
        include: {
            roles: { include: { rol: true } },
            _count: { select: { proyectosCreados: true } },
        },
    });

    return mapearUsuarioListado(usuario);
}

/**
 * RQF05 - Activar/desactivar una cuenta (solo Administrador). Al desactivar,
 * además se cierran de inmediato sus sesiones activas (RQF04) — si no, el
 * usuario podría seguir usando el sistema con un token/sesión ya vigente
 * hasta que expire por su cuenta, en vez de perder el acceso al instante.
 */
export async function cambiarEstadoUsuario(id_usuario: number, activo: boolean) {
    const existente = await prisma.usuario.findUnique({ where: { id_usuario } });
    if (!existente) throw new UsuarioNoEncontradoError();

    const [usuario] = await prisma.$transaction([
        prisma.usuario.update({
            where: { id_usuario },
            data: { activo },
            include: {
                roles: { include: { rol: true } },
                _count: { select: { proyectosCreados: true } },
            },
        }),
        ...(activo
            ? []
            : [
                prisma.sesionUsuario.updateMany({
                    where: { id_usuario, activa: true },
                    data: { activa: false, fecha_cierre: new Date() },
                }),
            ]),
    ]);

    return mapearUsuarioListado(usuario);
}
