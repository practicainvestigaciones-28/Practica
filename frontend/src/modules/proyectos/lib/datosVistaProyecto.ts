import * as proyectosApi from '../api/proyectos'
import * as documentosApi from '../api/documentos'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as usuariosLib from '../../usuarios/lib/usuarios'
import * as productosApi from '../api/productos'
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
    categoriasProducto,
    hojasVida: new Map(hojasVidaRes),
    egresados: new Map(egresadosRes),
  }
}
