import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/seguimiento'
import type { ConceptoRubro, TipoArticulacion, TipoNovedad, UnidadAntelacion } from '../api/tipos'
import { useAccion } from '../lib/useAccion'
import { Aviso, Encabezado, Pestanas } from '../components/UI'
import CatalogoEditable from '../components/CatalogoEditable'
import './Seguimiento.css'

type Catalogo = 'conceptos' | 'novedades' | 'articulacion'

/** Parametrización del Administrador para M-02, M-05 y M-08. */
function ParametrosSeguimiento() {
  const [catalogo, setCatalogo] = useState<Catalogo>('conceptos')
  const [conceptos, setConceptos] = useState<ConceptoRubro[]>([])
  const [tiposNovedad, setTiposNovedad] = useState<TipoNovedad[]>([])
  const [tiposArticulacion, setTiposArticulacion] = useState<TipoArticulacion[]>([])

  const cargar = useCallback(() => {
    api.listarConceptosRubro().then(setConceptos)
    api.listarTiposNovedad().then(setTiposNovedad)
    api.listarTiposArticulacion().then(setTiposArticulacion)
  }, [])
  const { ocupado, error, aviso, ejecutar } = useAccion(cargar)

  useEffect(() => {
    cargar()
  }, [cargar])

  const texto = (valor: string, cambiar: (v: string) => void, placeholder?: string) => (
    <input value={valor} placeholder={placeholder} onChange={(e) => cambiar(e.target.value)} />
  )
  const marca = (valor: boolean, cambiar: (v: boolean) => void, etiqueta: string) => (
    <input type="checkbox" aria-label={etiqueta} checked={valor} onChange={(e) => cambiar(e.target.checked)} />
  )

  return (
    <div className="seg-page">
      <Encabezado titulo="Parámetros de seguimiento" miga="Seguimiento › Parametrización">
        <p className="seg-ayuda">Catálogos que usan las solicitudes de rubro, las novedades y la articulación de los proyectos.</p>
      </Encabezado>

      <Pestanas
        opciones={[
          { valor: 'conceptos', etiqueta: 'Conceptos de rubro' },
          { valor: 'novedades', etiqueta: 'Tipos de novedad' },
          { valor: 'articulacion', etiqueta: 'Tipos de articulación' },
        ]}
        activa={catalogo}
        onCambiar={setCatalogo}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}

      <section className="seg-card">
        {catalogo === 'conceptos' && (
          <>
            <p className="seg-ayuda" style={{ marginBottom: 12 }}>
              La antelación mínima es el tiempo que debe haber entre la solicitud y la fecha en que se requiere el recurso.
            </p>
            <CatalogoEditable<ConceptoRubro>
              items={conceptos}
              textoAgregar="Añadir concepto"
              ocupado={ocupado}
              crearNuevo={() => ({ id: 0, nombre: '', antelacion_valor: 8, antelacion_unidad: 'días', descripcion: '', activo: true })}
              onGuardar={(c) => ejecutar(() => api.guardarConceptoRubro(c), 'Concepto guardado.')}
              onEliminar={(c) => ejecutar(() => api.eliminarConceptoRubro(c.id), 'Concepto eliminado.')}
              columnas={[
                { titulo: 'Concepto', render: (c, cambiar) => texto(c.nombre, (nombre) => cambiar({ nombre }), 'Nombre del concepto') },
                {
                  titulo: 'Antelación mínima',
                  render: (c, cambiar) => (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="number" min={0} style={{ width: 80 }} value={c.antelacion_valor}
                        onChange={(e) => cambiar({ antelacion_valor: Math.max(0, Number(e.target.value) || 0) })} />
                      <select value={c.antelacion_unidad} onChange={(e) => cambiar({ antelacion_unidad: e.target.value as UnidadAntelacion })}>
                        <option>días</option>
                        <option>meses</option>
                      </select>
                    </div>
                  ),
                },
                { titulo: 'Descripción', render: (c, cambiar) => texto(c.descripcion, (descripcion) => cambiar({ descripcion })) },
              ]}
            />
          </>
        )}

        {catalogo === 'novedades' && (
          <CatalogoEditable<TipoNovedad>
            items={tiposNovedad}
            textoAgregar="Añadir tipo de novedad"
            ocupado={ocupado}
            crearNuevo={() => ({ id: 0, nombre: '', descripcion: '', afecta_fechas: false, afecta_participantes: false, afecta_productos: false, activo: true })}
            onGuardar={(t) => ejecutar(() => api.guardarTipoNovedad(t), 'Tipo de novedad guardado.')}
            onEliminar={(t) => ejecutar(() => api.eliminarTipoNovedad(t.id), 'Tipo de novedad eliminado.')}
            columnas={[
              { titulo: 'Tipo', render: (t, cambiar) => texto(t.nombre, (nombre) => cambiar({ nombre }), 'Nombre del tipo') },
              { titulo: 'Descripción', render: (t, cambiar) => texto(t.descripcion, (descripcion) => cambiar({ descripcion })) },
              { titulo: 'Afecta fechas', centrada: true, render: (t, cambiar) => marca(t.afecta_fechas, (afecta_fechas) => cambiar({ afecta_fechas }), 'Afecta fechas') },
              { titulo: 'Afecta participantes', centrada: true, render: (t, cambiar) => marca(t.afecta_participantes, (afecta_participantes) => cambiar({ afecta_participantes }), 'Afecta participantes') },
              { titulo: 'Afecta productos', centrada: true, render: (t, cambiar) => marca(t.afecta_productos, (afecta_productos) => cambiar({ afecta_productos }), 'Afecta productos') },
            ]}
          />
        )}

        {catalogo === 'articulacion' && (
          <CatalogoEditable<TipoArticulacion>
            items={tiposArticulacion}
            textoAgregar="Añadir tipo de articulación"
            ocupado={ocupado}
            crearNuevo={() => ({ id: 0, nombre: '', descripcion: '', activo: true })}
            onGuardar={(t) => ejecutar(() => api.guardarTipoArticulacion(t), 'Tipo de articulación guardado.')}
            onEliminar={(t) => ejecutar(() => api.eliminarTipoArticulacion(t.id), 'Tipo de articulación eliminado.')}
            columnas={[
              { titulo: 'Nombre', render: (t, cambiar) => texto(t.nombre, (nombre) => cambiar({ nombre }), 'Nombre del tipo') },
              { titulo: 'Descripción', render: (t, cambiar) => texto(t.descripcion, (descripcion) => cambiar({ descripcion })) },
            ]}
          />
        )}
      </section>
    </div>
  )
}

export default ParametrosSeguimiento
