import * as proyectosApi from '../../proyectos/api/proyectos'

export interface CampoDatoGeneral {
  label: string
  valor: string
}

export function formatearMoneda(valor: string | null | undefined): string {
  const n = Number(valor)
  if (!valor || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

/**
 * Todo lo que el investigador diligencia en "Información general" del
 * registro del proyecto, sin el título (ya visible en el encabezado de la
 * página) — para el ítem "1. Datos Generales" / "1. Información General del
 * Proyecto" de los checklists oficiales de comité, en el mismo orden en que
 * aparecen en el formulario de registro.
 */
export function construirCamposDatosGenerales(
  proyecto: proyectosApi.ProyectoDetalle,
  participantes: proyectosApi.ParticipanteProyecto[],
  areas: proyectosApi.AreaDelProyecto[],
  programas: proyectosApi.ProgramaDelProyecto[],
  financiacion: proyectosApi.FinanciacionProyecto | null
): CampoDatoGeneral[] {
  const principal = participantes.find((p) => p.rolProyecto.nombre === 'Investigador(a) Principal UNICESMAG')
  const coInvestigadores = participantes.filter((p) => p.rolProyecto.nombre !== 'Investigador(a) Principal UNICESMAG')

  const campos: CampoDatoGeneral[] = [
    {
      label: 'Investigador principal',
      valor: principal
        ? `${principal.usuario ? principal.usuario.nombre : principal.nombre_manual} ${principal.usuario ? principal.usuario.apellido : principal.apellido_manual} (${principal.usuario ? principal.usuario.correo : principal.correo_manual})`
        : '—',
    },
  ]

  if (coInvestigadores.length > 0) {
    campos.push({
      label: 'Co-investigadores',
      valor: coInvestigadores
        .map((p) => `${p.usuario ? p.usuario.nombre : p.nombre_manual} ${p.usuario ? p.usuario.apellido : p.apellido_manual} — ${p.rolProyecto.nombre}`)
        .join(', '),
    })
  }

  campos.push(
    { label: 'Modalidad', valor: proyecto.modalidad?.nombre ?? '—' },
    { label: 'Área de conocimiento', valor: areas.length > 0 ? areas.map((a) => a.area.nombre).join(', ') : '—' },
    {
      label: 'Programa académico',
      valor: programas.length > 0 ? programas.map((p) => p.programa?.nombre ?? p.programa_otro ?? '—').join(', ') : '—',
    },
    {
      label: 'Ubicación',
      valor: proyecto.ciudad ? `${proyecto.ciudad}${proyecto.departamento ? `, ${proyecto.departamento}` : ''}` : '—',
    },
    { label: 'Duración', valor: proyecto.duracion_periodos ? `${proyecto.duracion_periodos} periodo(s)` : '—' },
    { label: 'Tipo de proyecto', valor: proyecto.tipoProyecto?.nombre ?? '—' }
  )

  if (financiacion) {
    campos.push({
      label: 'Financiación',
      valor: `Solicitado a UNICESMAG: ${formatearMoneda(financiacion.valor_solicitado_unicesmag)} — Contrapartida: ${formatearMoneda(financiacion.valor_contrapartida)} — Total: ${formatearMoneda(financiacion.valor_total)}`,
    })
  }

  return campos
}
