import type { EgresadosDetalle, GrupoDetalle } from '../lib/detalleItemChecklist'
import './DatosGeneralesVista.css'

function Campo({ label, valor, ancho = false }: { label: string; valor: string; ancho?: boolean }) {
  return (
    <div className={`dgv-campo${ancho ? ' dgv-campo-ancho' : ''}`}>
      <span className="dgv-etiqueta">{label}</span>
      <span className="dgv-valor">{valor}</span>
    </div>
  )
}

function TablaHoras({ titulo, filas }: { titulo: string; filas: { nombre: string; horas: string }[] }) {
  return (
    <div className="dgv-tabla">
      <div className="dgv-tabla-header">
        <span>{titulo}</span>
        <span>Dedicación (horas semanales)</span>
      </div>
      {filas.map((f, idx) => (
        <div className="dgv-tabla-row" key={idx}>
          <span>{f.nombre}</span>
          <span>{f.horas}</span>
        </div>
      ))}
    </div>
  )
}

/** Ítem "Información general del grupo de investigación" del checklist: igual que en la vista del proyecto. */
function GruposVista({ grupos, egresados }: { grupos: GrupoDetalle[]; egresados: EgresadosDetalle | null }) {
  return (
    <div className="dgv">
      {grupos.map((g, idx) => (
        <div className="dgv-participante" key={idx}>
          <div className="dgv-participante-encabezado">
            <span className="dgv-participante-nombre">{g.nombre}</span>
            <span className="dgv-participante-rol">
              {g.externo ? 'Externo' : g.principal ? 'Grupo principal (adscripción)' : 'CESMAG'}
            </span>
          </div>
          <div className="dgv-grid dgv-grid-compacta">
            <Campo label={g.externo ? 'Universidad / Entidad' : 'Facultad'} valor={g.facultad} />
            <Campo label={g.externo ? 'Programa / Dependencia' : 'Programa'} valor={g.programa} />
            <Campo label={g.externo ? 'Director del grupo' : 'Líder del grupo'} valor={g.lider} />
            {g.externo && <Campo label="Dedicación del director" valor={g.dedicacionDirector} />}
            <Campo label="Código GrupLAC" valor={g.codigoGruplac} />
            <Campo label="Reconocido por Minciencias" valor={g.reconocidoMinciencias} />
            <Campo label="Categoría" valor={g.categoria} />
            <Campo label="Acuerdo institucional" valor={g.acuerdo} ancho />
            <Campo label="Línea(s) de investigación" valor={g.linea} ancho />
            {g.externo ? (
              <Campo label="Línea(s) medular(es) institucional(es)" valor={g.lineasMedulares} ancho />
            ) : (
              <Campo label="ODS" valor={g.ods} ancho />
            )}
          </div>
          {g.investigadores.length > 0 && (
            <TablaHoras
              titulo={g.externo ? 'Investigadores externos del proyecto' : 'Investigadores UNICESMAG del proyecto'}
              filas={g.investigadores}
            />
          )}
        </div>
      ))}

      {egresados && (
        <div className="dgv-participante">
          <div className="dgv-participante-encabezado">
            <span className="dgv-participante-nombre">Información general de egresados(as)</span>
          </div>
          <div className="dgv-grid dgv-grid-compacta">
            <Campo label="Facultad" valor={egresados.facultad} />
            <Campo label="Programa" valor={egresados.programa} />
            <Campo label="Empresa o entidad" valor={egresados.empresa} />
          </div>
          {egresados.integrantes.length > 0 && (
            <TablaHoras titulo="Co investigador(a) egresado(a)" filas={egresados.integrantes} />
          )}
        </div>
      )}
    </div>
  )
}

export default GruposVista
