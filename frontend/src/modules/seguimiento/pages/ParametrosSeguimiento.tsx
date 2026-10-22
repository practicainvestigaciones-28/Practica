import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/seguimiento'
import type { TipoArticulacion, TipoNovedad } from '../api/tipos'
import { useAccion } from '../lib/useAccion'
import MensajeAccion from '../components/MensajeAccion'
import { Encabezado, Pestanas } from '../components/UI'
import CatalogoEditable from '../components/CatalogoEditable'
import './Seguimiento.css'

type Catalogo = 'novedades' | 'articulacion'

/** Parametrización del Administrador para las novedades y la articulación. */
function ParametrosSeguimiento() {
  const [catalogo, setCatalogo] = useState<Catalogo>('novedades')
  const [tiposNovedad, setTiposNovedad] = useState<TipoNovedad[]>([])
  const [tiposArticulacion, setTiposArticulacion] = useState<TipoArticulacion[]>([])

  const cargar = useCallback(() => {
    api.listarTiposNovedad().then(setTiposNovedad)
    api.listarTiposArticulacion().then(setTiposArticulacion)
  }, [])
  const { ocupado, error, aviso, ancla, ejecutar } = useAccion(cargar)

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
        <p className="seg-ayuda">Catálogos que usan las novedades y la articulación de los proyectos.</p>
      </Encabezado>

      <Pestanas
        opciones={[
          { valor: 'novedades', etiqueta: 'Tipos de novedad' },
          { valor: 'articulacion', etiqueta: 'Tipos de articulación' },
        ]}
        activa={catalogo}
        onCambiar={setCatalogo}
      />

      <MensajeAccion error={error} aviso={aviso} ancla={ancla} />

      <section className="seg-card">
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
