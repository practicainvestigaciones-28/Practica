/**
 * Integración con Ruah (sistema académico institucional): Ruah da acceso de solo lectura a su base de datos (esquema
 * view_report, que actualiza cada semestre). Este servicio trae esos datos y los inserta/actualiza en nuestras tablas:
 * Usuario (docentes, con su programa) y el catálogo aparte de estudiantes, que no tienen cuenta con login.
 *
 * La contraseña siempre es local: Ruah es solo fuente de datos de directorio, nunca de autenticación.
 */
import { Pool } from "pg";
import { prisma } from "../config/prisma";
import type { Prisma } from "../generated/prisma/client";
import { env } from "../config/env";
import { compararContraseña, contraseñaInicialPorCedula, hashearContraseña } from "../utils/password";
import { enviarCorreoBienvenida } from "../auth/email.service";
import { claveNombre, esDepartamento, nombrePropio, soloDigitos, tipoProgramaPorNombre, unirNombre } from "./ruah.utils";

export class RuahNoConfiguradoError extends Error {
  constructor() {
    super("La integración con Ruah todavía no está configurada: falta la conexión a su base de datos (RUAH_DATABASE_URL).");
  }
}

export class RuahConexionError extends Error {
  constructor(detalle: string) {
    super(`No se pudo consultar la base de datos de Ruah: ${detalle}`);
  }
}

const ROL_DOCENTE = "Investigador";
/** Pausa entre correos de bienvenida, para no saturar el SMTP. */
const PAUSA_ENTRE_CORREOS_MS = 400;

/** Corre una consulta de solo lectura en Ruah con una conexión que se abre y se cierra en cada sincronización. */
async function consultarRuah<T extends object>(sql: string): Promise<T[]> {
  if (!env.RUAH_DATABASE_URL) throw new RuahNoConfiguradoError();
  const pool = new Pool({ connectionString: env.RUAH_DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const { rows } = await pool.query(sql);
    return rows as T[];
  } catch (error) {
    throw new RuahConexionError(error instanceof Error ? error.message : "error desconocido");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Programas: se cruzan con nuestro catálogo por nombre y, si Ruah trae uno que no existe, se crea.
// ---------------------------------------------------------------------------

interface ProgramaRuah {
  nombre_programa: string;
  nombre_facultad: string | null;
}

class ResolutorProgramas {
  private porClave = new Map<string, number>();
  private facultades = new Map<string, number>();
  private departamentos = new Map<string, number>();
  private tipos = new Map<string, number>();
  readonly creados: string[] = [];
  readonly sinFacultad: string[] = [];

  private constructor(private facultadDePrograma: Map<string, string>) {}

  static async crear(): Promise<ResolutorProgramas> {
    const programasRuah = await consultarRuah<ProgramaRuah>(
      "select nombre_programa, nombre_facultad from view_report.vista_programas"
    );
    const r = new ResolutorProgramas(
      new Map(programasRuah.filter((p) => p.nombre_facultad).map((p) => [claveNombre(p.nombre_programa), p.nombre_facultad as string]))
    );
    for (const p of await prisma.programa.findMany({ select: { id_programa: true, nombre: true } })) r.porClave.set(claveNombre(p.nombre), p.id_programa);
    for (const f of await prisma.facultad.findMany()) r.facultades.set(claveNombre(f.nombre), f.id_facultad);
    for (const d of await prisma.departamento.findMany()) r.departamentos.set(claveNombre(d.nombre), d.id_departamento);
    for (const t of await prisma.tipoPrograma.findMany()) r.tipos.set(t.nombre, t.id_tipo_programa);
    return r;
  }

  /** Id del programa en nuestro catálogo (lo crea si no existe); null si no se puede ubicar en ninguna facultad ni departamento. */
  async resolver(nombreRuah: string | null | undefined): Promise<number | null> {
    const nombre = (nombreRuah ?? "").trim();
    if (!nombre) return null;
    const clave = claveNombre(nombre);
    const existente = this.porClave.get(clave);
    if (existente) return existente;

    // Un programa pertenece a una facultad o a un departamento: lo que no se pueda ubicar se reporta y no se crea.
    let id_facultad: number | null = null;
    let id_departamento: number | null = null;
    if (esDepartamento(nombre)) {
      id_departamento = await this.obtenerDepartamento(nombre);
    } else {
      const facultadRuah = this.facultadDePrograma.get(clave);
      if (!facultadRuah) {
        if (!this.sinFacultad.includes(nombre)) this.sinFacultad.push(nombre);
        return null;
      }
      id_facultad = await this.obtenerFacultad(facultadRuah);
    }

    const id_tipo_programa = this.tipos.get(tipoProgramaPorNombre(nombre));
    if (!id_tipo_programa) return null;
    const creado = await prisma.programa.create({
      data: { nombre: nombrePropio(esDepartamento(nombre) ? nombre.replace(/^\s*departamento( de)?\s*/i, "") : nombre), id_facultad, id_departamento, id_tipo_programa },
    });
    this.porClave.set(clave, creado.id_programa);
    this.creados.push(creado.nombre);
    return creado.id_programa;
  }

  private async obtenerFacultad(nombreRuah: string): Promise<number> {
    const clave = claveNombre(nombreRuah);
    const existente = this.facultades.get(clave);
    if (existente) return existente;
    const creada = await prisma.facultad.create({ data: { nombre: nombrePropio(nombreRuah.replace(/^\s*faculta(d)?( de)?\s*/i, "")) } });
    this.facultades.set(clave, creada.id_facultad);
    return creada.id_facultad;
  }

  private async obtenerDepartamento(nombreRuah: string): Promise<number> {
    const clave = claveNombre(nombreRuah);
    const existente = this.departamentos.get(clave);
    if (existente) return existente;
    const creado = await prisma.departamento.create({ data: { nombre: nombrePropio(nombreRuah.replace(/^\s*departamento( de)?\s*/i, "")) } });
    this.departamentos.set(clave, creado.id_departamento);
    return creado.id_departamento;
  }
}

// ---------------------------------------------------------------------------
// Docentes
// ---------------------------------------------------------------------------

interface DocenteRuah {
  cedula: string | null;
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  nombre_programa: string | null;
  estado: boolean | null;
  correo_institucional: string | null;
}

export interface ResumenSincronizacionDocentes {
  total_en_ruah: number;
  creados: number;
  actualizados: number;
  sin_cambios: number;
  omitidos_sin_correo: number;
  omitidos_sin_cedula: number;
  omitidos_inactivos: number;
  conflictos: { cedula: string; nombre: string; motivo: string }[];
  programas_creados: string[];
  programas_sin_ubicar: string[];
}

const SQL_DOCENTES = `
  select numero_identificacion::text as cedula,
         "PRIMER_NOMBRE" as primer_nombre, "SEGUNDO_NOMBRE" as segundo_nombre,
         "PRIMER_APELLIDO" as primer_apellido, "SEGUNDO_APELLIDO" as segundo_apellido,
         nombre_programa, estado, correo_institucional
  from view_report.vista_docentes
  order by numero_identificacion`;

export class BienvenidasDesactivadasError extends Error {
  constructor() {
    super("El envío de correos de bienvenida está desactivado (RUAH_ENVIAR_CORREOS). Actívalo en el servidor para poder enviarlos.");
  }
}

export class BienvenidasEnCursoError extends Error {
  constructor() {
    super("Ya hay un envío de correos de bienvenida en curso. Espera a que termine.");
  }
}

interface BienvenidaPendiente {
  id_usuario: number;
  correo: string;
  nombre: string;
  contraseña: string;
  roles: string[];
}

let enviandoBienvenidas = false;

/**
 * Cuentas a las que aún se les debe el correo de bienvenida: activas, sin correo enviado, que todavía no han cambiado su
 * contraseña inicial y cuya contraseña es de verdad la de la sincronización ("P.2027#" + cédula). Esto último se comprueba
 * contra el hash guardado: así nunca se le manda esa contraseña a una cuenta creada a mano (con otra clave) ni a quien ya la cambió.
 */
async function bienvenidasPendientes(): Promise<BienvenidaPendiente[]> {
  const candidatas = await prisma.usuario.findMany({
    where: { activo: true, debe_cambiar_contrasena: true, bienvenida_enviada_en: null, cedula: { not: null } },
    select: { id_usuario: true, correo: true, nombre: true, apellido: true, cedula: true, contraseña: true, roles: { select: { rol: { select: { nombre: true } } } } },
    orderBy: { id_usuario: "asc" },
  });
  const pendientes: BienvenidaPendiente[] = [];
  for (const u of candidatas) {
    const cedula = soloDigitos(u.cedula);
    if (!cedula) continue;
    const inicial = contraseñaInicialPorCedula(cedula);
    if (!(await compararContraseña(inicial, u.contraseña))) continue;
    pendientes.push({
      id_usuario: u.id_usuario,
      correo: u.correo,
      nombre: `${u.nombre} ${u.apellido}`.trim(),
      contraseña: inicial,
      roles: u.roles.map((r) => r.rol.nombre),
    });
  }
  return pendientes;
}

/** Cuántas cuentas recibirían hoy el correo de bienvenida, y si el envío está habilitado en el servidor. */
export async function contarBienvenidasPendientes(): Promise<{ pendientes: number; correos_activos: boolean; en_curso: boolean }> {
  return { pendientes: (await bienvenidasPendientes()).length, correos_activos: env.RUAH_ENVIAR_CORREOS, en_curso: enviandoBienvenidas };
}

/**
 * Manda la bienvenida a las cuentas pendientes, una tras otra y en segundo plano (la petición no espera). Cada correo enviado
 * deja marcada la cuenta, así que repetir el envío no le llega dos veces a nadie; los que fallen quedan pendientes.
 */
export async function enviarBienvenidasPendientes(): Promise<{ programados: number }> {
  if (!env.RUAH_ENVIAR_CORREOS) throw new BienvenidasDesactivadasError();
  if (enviandoBienvenidas) throw new BienvenidasEnCursoError();
  enviandoBienvenidas = true;
  let pendientes: BienvenidaPendiente[];
  try {
    pendientes = await bienvenidasPendientes();
  } catch (error) {
    enviandoBienvenidas = false;
    throw error;
  }

  void (async () => {
    let enviados = 0;
    let fallidos = 0;
    try {
      for (const p of pendientes) {
        try {
          await enviarCorreoBienvenida(p.correo, p.nombre, p.contraseña, p.roles.length > 0 ? p.roles : [ROL_DOCENTE]);
          await prisma.usuario.update({ where: { id_usuario: p.id_usuario }, data: { bienvenida_enviada_en: new Date() } });
          enviados++;
        } catch (error) {
          fallidos++;
          console.error(`Ruah: no se pudo enviar el correo de bienvenida a ${p.correo}:`, error);
        }
        await new Promise((r) => setTimeout(r, PAUSA_ENTRE_CORREOS_MS));
      }
      console.log(`Ruah: correos de bienvenida terminados — enviados ${enviados}, fallidos ${fallidos}.`);
    } finally {
      enviandoBienvenidas = false;
    }
  })();
  return { programados: pendientes.length };
}

/**
 * Trae los docentes de Ruah. Quien tiene correo institucional y cédula:
 * - no existe (se cruza por cédula, o por correo si esa cuenta no tenía cédula): se crea como Investigador con la contraseña
 *   inicial "P.2027#" + cédula, obligada a cambiarla en el primer ingreso;
 * - ya existe: se le actualizan el programa, el nombre y el apellido si cambiaron en Ruah (no se toca su contraseña ni sus roles, ni se le escribe).
 * Sin correo no se puede crear la cuenta, así que se omite.
 * La sincronización NO manda correos: la bienvenida se envía aparte (enviarBienvenidasPendientes), cuando el Administrador
 * decide, para poder actualizar primero las cuentas y revisarlas.
 */
export async function sincronizarDocentes(): Promise<ResumenSincronizacionDocentes> {
  const docentes = await consultarRuah<DocenteRuah>(SQL_DOCENTES);
  const programas = await ResolutorProgramas.crear();

  const rolDocente = await prisma.rol.findUnique({ where: { nombre: ROL_DOCENTE } });
  if (!rolDocente) throw new Error(`No existe el rol "${ROL_DOCENTE}" en el sistema.`);

  const usuarios = await prisma.usuario.findMany({ select: { id_usuario: true, nombre: true, apellido: true, correo: true, cedula: true, id_programa: true } });
  const porCedula = new Map<string, (typeof usuarios)[number]>();
  const porCorreo = new Map<string, (typeof usuarios)[number]>();
  for (const u of usuarios) {
    porCorreo.set(u.correo.toLowerCase(), u);
    const c = soloDigitos(u.cedula);
    if (c) porCedula.set(c, u);
  }

  const resumen: ResumenSincronizacionDocentes = {
    total_en_ruah: docentes.length,
    creados: 0,
    actualizados: 0,
    sin_cambios: 0,
    omitidos_sin_correo: 0,
    omitidos_sin_cedula: 0,
    omitidos_inactivos: 0,
    conflictos: [],
    programas_creados: [],
    programas_sin_ubicar: [],
  };
  const vistas = new Set<string>();

  for (const d of docentes) {
    const cedula = soloDigitos(d.cedula);
    const correo = (d.correo_institucional ?? "").trim().toLowerCase();
    const nombre = unirNombre(d.primer_nombre, d.segundo_nombre);
    const apellido = unirNombre(d.primer_apellido, d.segundo_apellido);
    const etiqueta = `${nombre} ${apellido}`.trim();

    if (d.estado === false) { resumen.omitidos_inactivos++; continue; }
    if (!cedula) { resumen.omitidos_sin_cedula++; continue; }
    if (!correo) { resumen.omitidos_sin_correo++; continue; }
    if (vistas.has(cedula)) { resumen.conflictos.push({ cedula, nombre: etiqueta, motivo: "La cédula aparece repetida en Ruah." }); continue; }
    vistas.add(cedula);

    try {
      const id_programa = await programas.resolver(d.nombre_programa);
      const cuentaConEseCorreo = porCorreo.get(correo);
      // Una cuenta con ese correo y sin cédula se toma como la misma persona; con otra cédula es un conflicto.
      const existente = porCedula.get(cedula) ?? (cuentaConEseCorreo && !soloDigitos(cuentaConEseCorreo.cedula) ? cuentaConEseCorreo : undefined);

      if (existente) {
        const cambios: { id_programa?: number; cedula?: string; nombre?: string; apellido?: string } = {};
        if (id_programa && existente.id_programa !== id_programa) cambios.id_programa = id_programa;
        if (!soloDigitos(existente.cedula)) cambios.cedula = cedula;
        // Si Ruah corrigió el nombre o el apellido, la cuenta lo sigue (sin dejarlos vacíos si Ruah no los trae).
        if (nombre && existente.nombre !== nombre) cambios.nombre = nombre;
        if (apellido && existente.apellido !== apellido) cambios.apellido = apellido;
        if (Object.keys(cambios).length === 0) { resumen.sin_cambios++; continue; }
        await prisma.usuario.update({ where: { id_usuario: existente.id_usuario }, data: cambios });
        resumen.actualizados++;
        continue;
      }

      if (porCorreo.has(correo)) {
        resumen.conflictos.push({ cedula, nombre: etiqueta, motivo: `El correo ${correo} ya lo usa una cuenta con otra cédula.` });
        continue;
      }

      const contraseñaInicial = contraseñaInicialPorCedula(cedula);
      const creado = await prisma.usuario.create({
        data: {
          nombre,
          apellido,
          correo,
          cedula,
          contraseña: await hashearContraseña(contraseñaInicial),
          debe_cambiar_contrasena: true,
          id_programa,
          roles: { create: [{ id_rol: rolDocente.id_rol }] },
        },
        select: { id_usuario: true, nombre: true, apellido: true, correo: true, cedula: true, id_programa: true },
      });
      porCedula.set(cedula, creado);
      porCorreo.set(correo, creado);
      resumen.creados++;
    } catch (error) {
      resumen.conflictos.push({ cedula, nombre: etiqueta, motivo: error instanceof Error ? error.message : "Error desconocido al guardar." });
    }
  }

  resumen.programas_creados = programas.creados;
  resumen.programas_sin_ubicar = programas.sinFacultad;
  return resumen;
}

// ---------------------------------------------------------------------------
// Estudiantes
// ---------------------------------------------------------------------------

interface EstudianteRuah {
  codigo: string;
  codigo_programa: string | null;
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  documento: string | null;
  telefono: string | null;
  email_personal: string | null;
  email_institucional: string | null;
  matriculado: boolean;
}

export interface ResumenSincronizacionEstudiantes {
  total_en_ruah: number;
  creados: number;
  actualizados: number;
  sin_cambios: number;
  matriculados: number;
  no_matriculados: number;
  sin_programa: number;
  programas_creados: string[];
  programas_sin_ubicar: string[];
}

// Todos los estudiantes conocidos por Ruah (uno por código) y si siguen matriculados en el último corte.
const SQL_ESTUDIANTES = `
  with base as (
    select "CODIGO", "CODIGO_PROGRAMA", "PRIMER_NOMBRE", "SEGUNDO_NOMBRE", "PRIMER_APELLIDO", "SEGUNDO_APELLIDO",
           "DOCUMENTO", "TELEFONO_CEL", "EMAIL_PERSONAL", "EMAIL_INSTITUCIONAL"
    from view_report.vista_informacion_estudiantes
    union
    select "CODIGO", "CODIGO_PROGRAMA", "PRIMER_NOMBRE", "SEGUNDO_NOMBRE", "PRIMER_APELLIDO", "SEGUNDO_APELLIDO",
           "DOCUMENTO", "TELEFONO_CEL", "EMAIL_PERSONAL", "EMAIL_INSTITUCIONAL"
    from view_report.vista_estudiantes_matriculados
  )
  select distinct on (b."CODIGO")
         b."CODIGO" as codigo, b."CODIGO_PROGRAMA" as codigo_programa,
         b."PRIMER_NOMBRE" as primer_nombre, b."SEGUNDO_NOMBRE" as segundo_nombre,
         b."PRIMER_APELLIDO" as primer_apellido, b."SEGUNDO_APELLIDO" as segundo_apellido,
         b."DOCUMENTO" as documento, b."TELEFONO_CEL" as telefono,
         b."EMAIL_PERSONAL" as email_personal, b."EMAIL_INSTITUCIONAL" as email_institucional,
         (m."CODIGO" is not null) as matriculado
  from base b
  left join (select distinct "CODIGO" from view_report.vista_estudiantes_matriculados) m on m."CODIGO" = b."CODIGO"
  order by b."CODIGO"`;

const TAMAÑO_LOTE = 500;

export interface EstudianteEncontrado {
  codigo: string;
  nombres: string;
  apellidos: string;
  correo_institucional: string | null;
  programa: string | null;
  matriculado: boolean;
}

/** Busca un estudiante por su código en el catálogo ya sincronizado (no consulta Ruah en vivo). Null si no está. */
export async function buscarEstudiantePorCodigo(codigo: string): Promise<EstudianteEncontrado | null> {
  const limpio = codigo.trim();
  if (!limpio) return null;
  const e = await prisma.estudianteRuah.findUnique({ where: { codigo: limpio }, include: { programa: { select: { nombre: true } } } });
  if (!e) return null;
  return {
    codigo: e.codigo,
    nombres: e.nombres,
    apellidos: e.apellidos,
    correo_institucional: e.correo_institucional,
    programa: e.programa?.nombre ?? null,
    matriculado: e.matriculado,
  };
}

/** Mínimo de caracteres del código para listar coincidencias, y cuántas se devuelven como máximo. */
export const MINIMO_CARACTERES_BUSQUEDA = 3;
export const MAXIMO_COINCIDENCIAS = 20;

/**
 * Estudiantes cuyo código EMPIEZA por lo escrito (buscador que lista mientras se escribe), del catálogo ya sincronizado: primero
 * los matriculados y luego por código. Con menos de MINIMO_CARACTERES_BUSQUEDA caracteres no devuelve nada. El código solo lleva
 * letras y números, así que se limpia cualquier otro carácter.
 */
export async function buscarEstudiantes(texto: string): Promise<EstudianteEncontrado[]> {
  const limpio = texto.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  if (limpio.length < MINIMO_CARACTERES_BUSQUEDA) return [];
  const filas = await prisma.estudianteRuah.findMany({
    where: { codigo: { startsWith: limpio } },
    include: { programa: { select: { nombre: true } } },
    orderBy: [{ matriculado: "desc" }, { codigo: "asc" }],
    take: MAXIMO_COINCIDENCIAS,
  });
  return filas.map((e) => ({
    codigo: e.codigo,
    nombres: e.nombres,
    apellidos: e.apellidos,
    correo_institucional: e.correo_institucional,
    programa: e.programa?.nombre ?? null,
    matriculado: e.matriculado,
  }));
}

/**
 * Nombre del programa de Ruah según el código del estudiante. Varios programas comparten código (coterminalidades y movilidades
 * usan "0"): si quitando coterminalidades y movilidades queda uno solo se usa ese; si sigue siendo ambiguo, el estudiante queda sin programa.
 */
function programaPorCodigo(programas: { codigo: string | null; nombre_programa: string }[]): Map<string, string> {
  const porCodigo = new Map<string, string[]>();
  for (const p of programas) {
    if (p.codigo == null) continue;
    porCodigo.set(p.codigo, [...(porCodigo.get(p.codigo) ?? []), p.nombre_programa]);
  }
  const resultado = new Map<string, string>();
  for (const [codigo, nombres] of porCodigo) {
    const candidatos = nombres.length === 1 ? nombres : nombres.filter((n) => !/^\s*(coterminalidad|movilidad)/i.test(n));
    if (candidatos.length === 1) resultado.set(codigo, candidatos[0]);
  }
  return resultado;
}

/**
 * Trae los estudiantes de Ruah a `estudiante_ruah` (no son cuentas con login). Se cruza por código estudiantil: los nuevos se
 * insertan, los que cambiaron se actualizan, y quien ya no aparece como matriculado queda con matriculado = false (no se borra).
 */
export async function sincronizarEstudiantes(): Promise<ResumenSincronizacionEstudiantes> {
  const estudiantes = await consultarRuah<EstudianteRuah>(SQL_ESTUDIANTES);
  const programasRuah = await consultarRuah<{ codigo: string | null; nombre_programa: string }>(
    "select codigo, nombre_programa from view_report.vista_programas"
  );
  const nombreDelCodigo = programaPorCodigo(programasRuah);
  const programas = await ResolutorProgramas.crear();

  const existentes = new Map(
    (await prisma.estudianteRuah.findMany()).map((e) => [e.codigo, e])
  );
  const vistos = new Set<string>();
  const nuevos: Prisma.EstudianteRuahCreateManyInput[] = [];
  const actualizaciones: { id: number; data: Prisma.EstudianteRuahUncheckedUpdateInput }[] = [];
  const resumen: ResumenSincronizacionEstudiantes = {
    total_en_ruah: estudiantes.length,
    creados: 0,
    actualizados: 0,
    sin_cambios: 0,
    matriculados: 0,
    no_matriculados: 0,
    sin_programa: 0,
    programas_creados: [],
    programas_sin_ubicar: [],
  };

  for (const e of estudiantes) {
    const codigo = (e.codigo ?? "").trim();
    if (!codigo) continue;
    vistos.add(codigo);
    const texto = (v: string | null | undefined) => (v ?? "").trim() || null;
    const id_programa = e.codigo_programa ? await programas.resolver(nombreDelCodigo.get(e.codigo_programa)) : null;
    if (!id_programa) resumen.sin_programa++;
    if (e.matriculado) resumen.matriculados++;
    else resumen.no_matriculados++;

    const datos = {
      codigo,
      documento: texto(e.documento),
      nombres: unirNombre(e.primer_nombre, e.segundo_nombre),
      apellidos: unirNombre(e.primer_apellido, e.segundo_apellido),
      correo_institucional: texto(e.email_institucional)?.toLowerCase() ?? null,
      correo_personal: texto(e.email_personal)?.toLowerCase() ?? null,
      telefono: texto(e.telefono),
      id_programa,
      matriculado: e.matriculado,
    };

    const actual = existentes.get(codigo);
    if (!actual) {
      nuevos.push(datos);
      continue;
    }
    const cambio = (Object.keys(datos) as (keyof typeof datos)[]).some((k) => datos[k] !== actual[k]);
    if (cambio) actualizaciones.push({ id: actual.id_estudiante_ruah, data: datos });
    else resumen.sin_cambios++;
  }

  // Quien estaba en el catálogo y Ruah ya no trae: se marca como no matriculado.
  const desaparecidos = [...existentes.values()].filter((e) => !vistos.has(e.codigo) && e.matriculado).map((e) => e.id_estudiante_ruah);

  for (let i = 0; i < nuevos.length; i += TAMAÑO_LOTE) {
    await prisma.estudianteRuah.createMany({ data: nuevos.slice(i, i + TAMAÑO_LOTE) });
  }
  resumen.creados = nuevos.length;
  for (let i = 0; i < actualizaciones.length; i += TAMAÑO_LOTE) {
    await prisma.$transaction(
      actualizaciones.slice(i, i + TAMAÑO_LOTE).map((a) => prisma.estudianteRuah.update({ where: { id_estudiante_ruah: a.id }, data: a.data }))
    );
  }
  resumen.actualizados = actualizaciones.length;
  if (desaparecidos.length > 0) await prisma.estudianteRuah.updateMany({ where: { id_estudiante_ruah: { in: desaparecidos } }, data: { matriculado: false } });

  resumen.programas_creados = programas.creados;
  resumen.programas_sin_ubicar = programas.sinFacultad;
  return resumen;
}
