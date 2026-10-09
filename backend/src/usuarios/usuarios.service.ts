import { prisma } from "../config/prisma";
import { hashearContraseña, generarContraseñaTemporal } from "../utils/password";
import { enviarCorreoBienvenida } from "../auth/email.service";
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

export class UsuarioConDatosAsociadosError extends Error {
    constructor() {
        super(
            "No se puede eliminar: el usuario todavía tiene proyectos, evaluaciones, participaciones, pagos u otra información asociada en el sistema. Si quieres quitarle el acceso, desactívalo en vez de eliminarlo."
        );
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

    const usuarios = await prisma.usuario.findMany({
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
            // Para que la búsqueda de participantes de un proyecto pueda
            // seguir ignorando este campo, y para que el panel de Usuarios
            // pueda distinguir quién todavía no tiene ningún rol asignado
            // (ver RQF17 arriba): sin esto, un co-investigador o externo
            // guardado sin rol queda invisible para asignarle uno después.
            roles: { select: { rol: { select: { nombre: true } } } },
        },
        take: 10,
        orderBy: { nombre: "asc" },
    });

    return usuarios.map((u) => ({ ...u, roles: u.roles.map((r) => r.rol.nombre) }));
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
 * Solo devuelve usuarios con roles de acceso al sistema:
 * Administrador, Investigador, Comité de Investigación, Comité de Ética, Par Evaluador.
 * NO incluye co-investigadores ni otros roles sin acceso.
 * Incluye los roles reales de cada uno y cuántos proyectos ha creado.
 * Paginado (RNF02/RNF07) — no se carga la tabla completa de una sola vez.
 */
export async function listarUsuarios(paginacion: ParametrosPaginacion) {
    // Roles de sistema con acceso de administración/evaluación
    const rolesPermitidos = [
        "Administrador",
        "Investigador",
        "Comité de Investigación",
        "Comité de Ética",
        "Par Evaluador",
        "Líder de investigación",
    ];

    const [total, usuarios] = await Promise.all([
        // Total de usuarios CON ROLES PERMITIDOS
        prisma.usuario.count({
            where: {
                roles: {
                    some: {
                        rol: { nombre: { in: rolesPermitidos } },
                    },
                },
            },
        }),
        // Usuarios CON ROLES PERMITIDOS, paginados
        prisma.usuario.findMany({
            where: {
                roles: {
                    some: {
                        rol: { nombre: { in: rolesPermitidos } },
                    },
                },
            },
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
    /** Nombres de rol (ej. ["Investigador", "Comité de Investigación"]) — uno o varios, todos se asignan de una vez. */
    roles: string[];
    codigo?: string;
    cedula?: string;
}

/**
 * RQF05 - Registrar un nuevo usuario del sistema (solo Administrador,
 * validado en la ruta). La contraseña YA NO la escribe el Administrador ni
 * se genera en el frontend: el backend genera una temporal, crea la cuenta
 * marcada con debe_cambiar_contrasena (así el primer login exige cambiarla,
 * ver auth.service.ts/ProtectedRoute.tsx), y se la envía por correo a la
 * persona — necesario para cualquier usuario externo a la universidad que
 * nunca va a pasar en persona por el Administrador para que le "pasen" la
 * contraseña a mano, sea cual sea el rol (Par Evaluador, Investigador...).
 * El correo menciona el o los roles asignados, para que quien lo reciba
 * sepa con qué cuenta está entrando.
 *
 * Todos los roles se asignan en esta misma llamada (ya no hace falta un
 * segundo PUT /:id/roles aparte para el caso de varios roles): así el
 * correo, que se manda una sola vez aquí, siempre refleja la lista
 * completa — antes, si se mandaba antes de asignar el resto de roles,
 * el correo se quedaba diciendo solo el primero.
 *
 * Si el envío de correo falla (SMTP mal configurado, etc.), la cuenta queda
 * creada igual — no tendría sentido perder el registro por un problema de
 * correo — pero se avisa con correo_enviado=false para que el Administrador
 * sepa que debe resolverlo por otro medio (revisar la consola del backend,
 * donde queda igual el contenido, o reenviar más adelante).
 */
export async function crearUsuario(datos: DatosCrearUsuario) {
    const correo = datos.correo.toLowerCase().trim();
    const nombresRoles = [...new Set(datos.roles.map((r) => r.trim()).filter(Boolean))];
    if (nombresRoles.length === 0) throw new RolInvalidoError();

    const correoExistente = await prisma.usuario.findUnique({ where: { correo } });
    if (correoExistente) throw new CorreoDuplicadoError();

    const roles = await prisma.rol.findMany({ where: { nombre: { in: nombresRoles } } });
    if (roles.length !== nombresRoles.length) throw new RolInvalidoError();

    const contraseñaTemporal = generarContraseñaTemporal();
    const contraseñaHash = await hashearContraseña(contraseñaTemporal);

    const usuario = await prisma.usuario.create({
        data: {
            nombre: datos.nombre,
            apellido: datos.apellido,
            correo,
            contraseña: contraseñaHash,
            codigo: datos.codigo,
            cedula: datos.cedula,
            debe_cambiar_contrasena: true,
            roles: { create: roles.map((rol) => ({ id_rol: rol.id_rol })) },
        },
        include: {
            roles: { include: { rol: true } },
            _count: { select: { proyectosCreados: true } },
        },
    });

    let correo_enviado = true;
    try {
        await enviarCorreoBienvenida(
            usuario.correo,
            `${usuario.nombre} ${usuario.apellido}`,
            contraseñaTemporal,
            roles.map((rol) => rol.nombre)
        );
    } catch (error) {
        console.error(`No se pudo enviar el correo de bienvenida a ${usuario.correo}:`, error);
        correo_enviado = false;
    }

    return { ...mapearUsuarioListado(usuario), correo_enviado };
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

/**
 * RQF05 - Elimina DEFINITIVAMENTE un usuario (a diferencia de
 * cambiarEstadoUsuario, que solo le quita el acceso sin borrar nada). Antes
 * se limpia lo que es puramente propio de la cuenta y no deja rastro de
 * trabajo real (sesiones, notificaciones, tokens de recuperación, hoja de
 * vida, datos bancarios, el rol asignado) y luego se intenta borrar el
 * usuario: si tiene cualquier otro rastro real en el sistema —un proyecto
 * creado, una participación, una evaluación, un pago ya registrado, un
 * documento cargado, un grupo que lidera...— la propia base de datos lo
 * impide por las llaves foráneas en modo RESTRICT, y eso se traduce acá en
 * UsuarioConDatosAsociadosError: en ese caso la única opción es
 * desactivarlo (cambiarEstadoUsuario), no eliminarlo.
 */
export async function eliminarUsuario(id_usuario: number): Promise<void> {
    const existente = await prisma.usuario.findUnique({ where: { id_usuario } });
    if (!existente) throw new UsuarioNoEncontradoError();

    try {
        await prisma.$transaction([
            prisma.notificacion.deleteMany({ where: { id_usuario } }),
            prisma.sesionUsuario.deleteMany({ where: { id_usuario } }),
            prisma.tokenRecuperacion.deleteMany({ where: { id_usuario } }),
            prisma.hojaVida.deleteMany({ where: { id_usuario } }),
            prisma.datoBancarioPar.deleteMany({ where: { id_usuario } }),
            prisma.rolesUsuario.deleteMany({ where: { id_usuario } }),
            prisma.usuario.delete({ where: { id_usuario } }),
        ]);
    } catch (error: unknown) {
        // P2039 es el código que reporta el adaptador de pg para una
        // violación RESTRICT de llave foránea (visto ya antes al intentar
        // borrar usuarios con roles sin limpiar primero) — aquí puede
        // disparar por cualquiera de las tablas que SÍ representan trabajo
        // real (proyectos, participaciones, evaluaciones, pagos...).
        if (error && typeof error === "object" && "code" in error && error.code === "P2039") {
            throw new UsuarioConDatosAsociadosError();
        }
        throw error;
    }
}
