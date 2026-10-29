import * as proyectosApi from '../api/proyectos'
import * as documentosApi from '../api/documentos'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as usuariosLib from '../../usuarios/lib/usuarios'
import * as productosApi from '../api/productos'
import * as firmasProyectoApi from '../api/firmasProyecto'
import type { DatosVistaProyecto } from '../components/VistaDetalleProyecto'

/** Estudiantes y egresados no diligencian hoja de vida en el proyecto: solo se los menciona como participantes. */
export const ROLES_SIN_HOJA_VIDA = ['Estudiante Investigador(a)', 'Co investigador(a) Egresado(a) UNICESMAG']

/**
 * Junta todos los datos de un proyecto (participantes, grupos, financiación,
 * objetivos, documentos, hojas de vida...) en el mismo formato que usa
 * `VistaDetalleProyecto` para mostrarlo y que usa `exportarProyecto` para
 * generarlo en Word/PDF — así cualquier pantalla que necesite descargar el
 * documento oficial de un proyecto (no solo la vista de revisión del
 * Administrador) reutiliza exactamente la misma carga de datos.
 */
export async function cargarDatosVistaProyecto(id_proyecto: number): Promise<DatosVistaProyecto> {
  const [
    proyecto,
    participantes,
    areas,
    programas,
    financiacion,
    grupos,
    objetivos,
    antecedentes,
    referencias,
    actividades,
    productos,
    documentos,
    facultadesRes,
    programasRes,
    categoriasProducto,
    firmasRes,
    dedicacionesRes,
    egresadosInfoRes,
    hojasVidaProyectoRes,
  ] = await Promise.all([
    proyectosApi.obtenerProyecto(id_proyecto),
    proyectosApi.listarParticipantes(id_proyecto),
    proyectosApi.listarAreasProyecto(id_proyecto),
    proyectosApi.listarProgramasProyecto(id_proyecto),
    proyectosApi.obtenerFinanciacionProyecto(id_proyecto).catch(() => null),
    proyectosApi.listarGruposDelProyecto(id_proyecto),
    proyectosApi.listarObjetivosProyecto(id_proyecto),
    proyectosApi.listarAntecedentesProyecto(id_proyecto),
    proyectosApi.listarReferenciasProyecto(id_proyecto),
    proyectosApi.listarActividadesCronograma(id_proyecto),
    proyectosApi.listarProductosProyecto(id_proyecto),
    documentosApi.listarDocumentosProyecto(id_proyecto),
    catalogosApi.listarFacultades(),
    catalogosApi.listarProgramas(),
    productosApi.listarCategoriasProducto(),
    firmasProyectoApi.obtenerFirmas(id_proyecto).catch(() => ({ firmas: [], estado_actual: null })),
    catalogosApi.listarDedicaciones().catch(() => []),
    proyectosApi.obtenerEgresadosInfo(id_proyecto).catch(() => null),
    proyectosApi.listarHojasVidaProyecto(id_proyecto).catch(() => []),
  ])

  const [hojasVidaRes, egresadosRes] = await Promise.all([
    Promise.all(
      participantes
        .filter((p) => !ROLES_SIN_HOJA_VIDA.includes(p.rolProyecto.nombre) && p.participante != null)
        .map((p) =>
          usuariosLib
            .obtenerHojaVida(p.participante!)
            .then((hv) => [p.participante!, hv] as const)
            .catch(() => [p.participante!, null] as const)
        )
    ),
    Promise.all(
      participantes
        .filter((p) => p.rolProyecto.nombre === 'Co investigador(a) Egresado(a) UNICESMAG')
        .map((p) =>
          proyectosApi
            .obtenerInformacionEgresado(id_proyecto, p.id_usuarioproyecto)
            .then((eg) => [p.id_usuarioproyecto, eg] as const)
            .catch(() => [p.id_usuarioproyecto, null] as const)
        )
    ),
  ])

  return {
    proyecto,
    participantes,
    areas,
    programas,
    financiacion,
    grupos,
    objetivos,
    antecedentes,
    referencias,
    actividades,
    productos,
    documentos,
    facultades: new Map(facultadesRes.map((f) => [f.id_facultad, f.nombre])),
    programasCatalogo: new Map(programasRes.map((pr) => [pr.id_programa, pr.nombre])),
    dedicaciones: new Map(dedicacionesRes.flatMap((d) => (d.id_dedicacion != null ? [[d.id_dedicacion, d.nombre] as const] : []))),
    categoriasProducto,
    hojasVida: new Map(hojasVidaRes),
    egresados: new Map(egresadosRes),
    egresadosInfo: egresadosInfoRes,
    hojasVidaProyecto: hojasVidaProyectoRes,
    firmas: new Map(
      firmasRes.firmas.map((f) => [
        f.id_usuarioproyecto,
        {
          firmado: f.firmado,
          fecha_firma: f.fecha_firma,
          id_transaccion: f.id_transaccion,
          hash_firma: f.hash_firma,
          correo_verificacion_enmascarado: f.correo_verificacion_enmascarado,
        },
      ])
    ),
  }
}

const ROL_PRINCIPAL_HV = 'Investigador(a) Principal UNICESMAG'
const ROL_COINVESTIGADOR_HV = 'Co investigador(a) UNICESMAG'
const ROL_EXTERNO_HV = 'Co investigador(a) Externo(a)'

/** Campos de hoja de vida que muestran la vista y el PDF (los de la cuenta del usuario o los de la ficha del proyecto). */
export type HojaVidaMostrada = Partial<Record<
  | 'lugar_nacimiento'
  | 'fecha_nacimiento'
  | 'nacionalidad'
  | 'tipo_documento'
  | 'numero_documento'
  | 'direccion'
  | 'telefono'
  | 'celular'
  | 'cargo_actual'
  | 'cargos_desempenados'
  | 'titulos_academicos'
  | 'produccion_cientifica',
  string | null
>>

const normalizarTexto = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Investigadores con hoja de vida en el orden en que se ingresaron
 * (Principal, Co-investigador UNICESMAG, externos — estos dos según el orden
 * de sus fichas) y la hoja de vida de cada uno: la de su cuenta si la tiene
 * (el Principal) o, si no, la ficha diligenciada en el proyecto, emparejada
 * por correo y, si no coincide, por nombre completo.
 */
export function investigadoresConHojaVida(
  datos: DatosVistaProyecto
): { p: proyectosApi.ParticipanteProyecto; hv: HojaVidaMostrada | null }[] {
  const correoDe = (p: proyectosApi.ParticipanteProyecto) => normalizarTexto(p.usuario ? p.usuario.correo : p.correo_manual)
  const nombreDe = (p: proyectosApi.ParticipanteProyecto) =>
    normalizarTexto(p.usuario ? `${p.usuario.nombre} ${p.usuario.apellido}` : `${p.nombre_manual ?? ''} ${p.apellido_manual ?? ''}`)

  const emparejar = (rolParticipante: string, rolFicha: 'coinvestigador' | 'externo') => {
    const fichas = (datos.hojasVidaProyecto ?? []).filter((h) => h.rol === rolFicha).sort((a, b) => a.orden - b.orden)
    const usadas = new Set<number>()
    const participantes = datos.participantes.filter((p) => p.rolProyecto.nombre === rolParticipante)
    const conFicha = participantes.map((p) => {
      let i = fichas.findIndex((f, idx) => !usadas.has(idx) && correoDe(p) && normalizarTexto(f.datos.correo) === correoDe(p))
      if (i < 0) {
        i = fichas.findIndex(
          (f, idx) => !usadas.has(idx) && nombreDe(p) && normalizarTexto(`${f.datos.nombres ?? ''} ${f.datos.apellidos ?? ''}`) === nombreDe(p)
        )
      }
      if (i >= 0) usadas.add(i)
      return { p, i }
    })
    // Sin coincidencia por correo ni nombre: se les asigna la siguiente ficha libre, en orden.
    for (const item of conFicha) {
      if (item.i >= 0) continue
      const libre = fichas.findIndex((_, idx) => !usadas.has(idx))
      if (libre >= 0) {
        usadas.add(libre)
        item.i = libre
      }
    }
    return conFicha
      .sort((a, b) => (a.i < 0 ? Infinity : a.i) - (b.i < 0 ? Infinity : b.i) || a.p.id_usuarioproyecto - b.p.id_usuarioproyecto)
      .map(({ p, i }) => ({ p, ficha: i >= 0 ? (fichas[i].datos as HojaVidaMostrada) : null }))
  }

  const deCuenta = (p: proyectosApi.ParticipanteProyecto) => (p.participante != null ? datos.hojasVida.get(p.participante) ?? null : null)
  const principal = datos.participantes.find((p) => p.rolProyecto.nombre === ROL_PRINCIPAL_HV)

  return [
    ...(principal ? [{ p: principal, hv: deCuenta(principal) as HojaVidaMostrada | null }] : []),
    ...emparejar(ROL_COINVESTIGADOR_HV, 'coinvestigador').map(({ p, ficha }) => ({ p, hv: (deCuenta(p) as HojaVidaMostrada | null) ?? ficha })),
    ...emparejar(ROL_EXTERNO_HV, 'externo').map(({ p, ficha }) => ({ p, hv: (deCuenta(p) as HojaVidaMostrada | null) ?? ficha })),
  ]
}

/**
 * Todos los participantes en el orden en que se ingresaron: Principal,
 * Co-investigador UNICESMAG, externos (orden de sus fichas), egresados y
 * estudiantes; cualquier otro rol al final.
 */
export function participantesEnOrden(datos: DatosVistaProyecto): proyectosApi.ParticipanteProyecto[] {
  const investigadores = investigadoresConHojaVida(datos).map(({ p }) => p)
  const yaIncluidos = new Set(investigadores.map((p) => p.id_usuarioproyecto))
  const porRol = (rol: string) =>
    datos.participantes
      .filter((p) => p.rolProyecto.nombre === rol && !yaIncluidos.has(p.id_usuarioproyecto))
      .sort((a, b) => a.id_usuarioproyecto - b.id_usuarioproyecto)
  const egresados = porRol('Co investigador(a) Egresado(a) UNICESMAG')
  const estudiantes = porRol('Estudiante Investigador(a)')
  const ordenados = [...investigadores, ...egresados, ...estudiantes]
  const restantes = datos.participantes.filter((p) => !ordenados.includes(p))
  return [...ordenados, ...restantes]
}
