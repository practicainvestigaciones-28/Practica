import { Fragment } from 'react'
import type { TextosActa } from '../api/actaInicio'
import { textosDelActa } from '../lib/textosLegales'

/**
 * Numerales 5 a 10 del acta (compromisos y cláusulas) en solo lectura, desplegables. Los escribe el Administrador; quien firma
 * los lee para saber de qué se trata, no hay una aceptación aparte. `textos` son los editados (null = los del formato).
 */
function CompromisosActa({ textos }: { textos: TextosActa | null | undefined }) {
  const resueltos = textosDelActa(textos)
  return (
    <div>
      {resueltos.clausulas.map((c) => (
        <Fragment key={c.tipo}>
          <details className="acta-clausula-bloque">
            <summary>{c.titulo}</summary>
            <div className="acta-clausula-texto">{c.parrafos.map((p) => <p key={p}>{p}</p>)}</div>
          </details>
          {c.tipo === 'compromisos' && (
            <details className="acta-clausula-bloque">
              <summary>6. Solicitudes para asignación de rubros</summary>
              <table className="acta-tabla">
                <thead><tr><th>Concepto</th><th>Tiempo</th></tr></thead>
                <tbody>{resueltos.rubros.map(([concepto, tiempo]) => <tr key={concepto}><td>{concepto}</td><td>{tiempo}</td></tr>)}</tbody>
              </table>
            </details>
          )}
        </Fragment>
      ))}
      <details className="acta-clausula-bloque">
        <summary>10. Consideraciones finales</summary>
        <div className="acta-clausula-texto">{resueltos.consideraciones.map((p) => <p key={p}>{p}</p>)}</div>
      </details>
    </div>
  )
}

export default CompromisosActa
