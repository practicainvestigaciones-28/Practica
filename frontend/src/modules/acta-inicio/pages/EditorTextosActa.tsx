import { useEffect, useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import * as actaApi from '../api/actaInicio'
import { CLAVE_TEXTO_CLAUSULA, textosDelActa } from '../lib/textosLegales'

type ClaveParrafos = 'compromisos' | 'derechos_autor' | 'confidencialidad' | 'datos_personales' | 'consideraciones'

interface Props {
  acta: actaApi.ActaInicioDetalle
  ocupado: boolean
  ejecutar: (accion: () => Promise<unknown>, mensajeOk: string, zona: string) => Promise<void>
  mensaje: ReactNode
}

const aTexto = (parrafos: string[]) => parrafos.join('\n\n')
const aParrafos = (texto: string) =>
  texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/** Numerales 5 a 10 con el texto que tiene hoy el acta (el del formato o el que ya se editó), listos para editar en la misma caja. */
function estadoDe(acta: actaApi.ActaInicioDetalle) {
  const t = textosDelActa(acta.textos)
  const porClave = (clave: ClaveParrafos) =>
    clave === 'consideraciones' ? t.consideraciones : t.clausulas.find((c) => CLAVE_TEXTO_CLAUSULA[c.tipo] === clave)!.parrafos
  return {
    parrafos: Object.fromEntries((['compromisos', 'derechos_autor', 'confidencialidad', 'datos_personales', 'consideraciones'] as ClaveParrafos[]).map((k) => [k, aTexto(porClave(k))])) as Record<ClaveParrafos, string>,
    rubros: t.rubros.map(([c, x]) => [c, x] as [string, string]),
  }
}

/**
 * Edición de los numerales 5 a 10 del acta de inicio (compromisos, rubros, derechos de autor, confidencialidad, datos
 * personales y consideraciones finales) por el Administrador, mientras el acta está en elaboración. Los párrafos se separan con
 * una línea en blanco. Solo se guardan los numerales que cambian el texto del formato.
 */
function EditorTextosActa({ acta, ocupado, ejecutar, mensaje }: Props) {
  const [estado, setEstado] = useState(() => estadoDe(acta))

  useEffect(() => {
    setEstado(estadoDe(acta))
  }, [acta])

  const base = estadoDe({ ...acta, textos: null })
  const titulos: { clave: ClaveParrafos; titulo: string }[] = [
    { clave: 'compromisos', titulo: '5. Compromisos de los participantes' },
    { clave: 'derechos_autor', titulo: '7. Derechos de autor' },
    { clave: 'confidencialidad', titulo: '8. Compromiso de confidencialidad' },
    { clave: 'datos_personales', titulo: '9. Tratamiento de datos personales' },
    { clave: 'consideraciones', titulo: '10. Consideraciones finales' },
  ]

  const rubrosValidos = estado.rubros.length > 0 && estado.rubros.every(([c, t]) => c.trim() && t.trim())
  const parrafosValidos = titulos.every(({ clave }) => aParrafos(estado.parrafos[clave]).length > 0)

  // Lo que se envía: solo lo que cambia el texto del formato.
  const cambios = (): actaApi.TextosActa | null => {
    const editados: actaApi.TextosActa = {}
    for (const { clave } of titulos) {
      const parrafos = aParrafos(estado.parrafos[clave])
      if (aTexto(parrafos) !== base.parrafos[clave]) editados[clave] = parrafos
    }
    const rubros = estado.rubros.map(([c, t]) => [c.trim(), t.trim()] as [string, string])
    if (JSON.stringify(rubros) !== JSON.stringify(base.rubros)) editados.rubros = rubros
    return Object.keys(editados).length > 0 ? editados : null
  }
  const sinGuardar = JSON.stringify(cambios()) !== JSON.stringify(acta.textos ?? null)
  const hayEditados = acta.textos != null

  const cambiarRubro = (i: number, columna: 0 | 1, valor: string) =>
    setEstado((e) => ({ ...e, rubros: e.rubros.map((f, j) => (j === i ? ((columna === 0 ? [valor, f[1]] : [f[0], valor]) as [string, string]) : f)) }))

  return (
    <section className="acta-card acta-editor">
      <h3>5 a 10. Compromisos y cláusulas del acta (editables)</h3>
      <p className="acta-nota">
        Edita aquí los textos que aceptan y firman los investigadores. Separa los párrafos con una línea en blanco. Los cambios valen solo
        para esta acta y quedan en el PDF; después de generar el acta ya no se pueden modificar (hay que reabrirla). Lo que no cambies
        conserva el texto del formato.
      </p>

      {titulos.slice(0, 1).map(({ clave, titulo }) => (
        <label key={clave} className="acta-campo-editor">
          <h4>{titulo}</h4>
          <textarea className="acta-editor-texto" rows={10} value={estado.parrafos[clave]} onChange={(e) => setEstado((s) => ({ ...s, parrafos: { ...s.parrafos, [clave]: e.target.value } }))} />
        </label>
      ))}

      <h4>6. Solicitudes para asignación de rubros</h4>
      <table className="acta-editor-rubros">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', fontSize: 12 }}>Concepto</th>
            <th style={{ textAlign: 'left', fontSize: 12 }}>Tiempo de antelación</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {estado.rubros.map(([concepto, tiempo], i) => (
            <tr key={i}>
              <td style={{ width: '46%' }}>
                <textarea rows={2} aria-label={`Concepto ${i + 1}`} value={concepto} onChange={(e) => cambiarRubro(i, 0, e.target.value)} />
              </td>
              <td>
                <textarea rows={2} aria-label={`Tiempo ${i + 1}`} value={tiempo} onChange={(e) => cambiarRubro(i, 1, e.target.value)} />
              </td>
              <td style={{ width: 34 }}>
                <button type="button" className="acta-link" aria-label={`Quitar el rubro ${i + 1}`} disabled={estado.rubros.length <= 1} onClick={() => setEstado((s) => ({ ...s, rubros: s.rubros.filter((_, j) => j !== i) }))}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="acta-link" onClick={() => setEstado((s) => ({ ...s, rubros: [...s.rubros, ['', '']] }))}>
        <Plus size={13} /> Añadir rubro
      </button>

      {titulos.slice(1).map(({ clave, titulo }) => (
        <label key={clave} className="acta-campo-editor">
          <h4>{titulo}</h4>
          <textarea className="acta-editor-texto" rows={clave === 'consideraciones' ? 9 : 7} value={estado.parrafos[clave]} onChange={(e) => setEstado((s) => ({ ...s, parrafos: { ...s.parrafos, [clave]: e.target.value } }))} />
        </label>
      ))}

      {!parrafosValidos && <p className="acta-error">Ningún numeral puede quedar sin texto.</p>}
      {!rubrosValidos && <p className="acta-error">Cada rubro necesita su concepto y su tiempo.</p>}

      <div className="acta-acciones">
        <button
          type="button"
          className="acta-btn"
          disabled={ocupado || !sinGuardar || !parrafosValidos || !rubrosValidos}
          onClick={() => ejecutar(() => actaApi.guardarTextosActa(acta.id_proyecto, cambios()), 'Textos del acta guardados.', 'textos')}
        >
          Guardar textos del acta
        </button>
        {hayEditados && (
          <button
            type="button"
            className="acta-btn acta-btn-sec"
            disabled={ocupado}
            onClick={() => ejecutar(() => actaApi.guardarTextosActa(acta.id_proyecto, null), 'Se restablecieron los textos del formato.', 'textos')}
          >
            Restablecer los textos del formato
          </button>
        )}
      </div>
      {mensaje}
    </section>
  )
}

export default EditorTextosActa
