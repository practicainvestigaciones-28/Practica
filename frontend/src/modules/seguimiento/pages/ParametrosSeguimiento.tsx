import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/seguimiento'
import type { TipoNovedad } from '../api/tipos'
import { useAccion } from '../lib/useAccion'
import MensajeAccion from '../components/MensajeAccion'
import { Encabezado } from '../components/UI'
import CatalogoEditable from '../components/CatalogoEditable'
import { useCambios } from '../../../shared/realtime/RealtimeContext'
import './Seguimiento.css'

/** Parametrización del Administrador para las novedades. */
function ParametrosSeguimiento() {
  const [tiposNovedad, setTiposNovedad] = useState<TipoNovedad[]>([])

  const cargar = useCallback(() => {
    api.listarTiposNovedad().then(setTiposNovedad)
  }, [])
  const { ocupado, error, aviso, ancla, ejecutar } = useAccion(cargar)

  useEffect(() => {
    cargar()
  }, [cargar])

  useCambios('seguimiento', cargar)

  const texto = (valor: string, cambiar: (v: string) => void, placeholder?: string) => (
    <input value={valor} placeholder={placeholder} onChange={(e) => cambiar(e.target.value)} />
  )
  const marca = (valor: boolean, cambiar: (v: boolean) => void, etiqueta: string) => (
    <input type="checkbox" aria-label={etiqueta} checked={valor} onChange={(e) => cambiar(e.target.checked)} />
  )

  return (
    <div className="seg-page">
      <Encabezado titulo="Parámetros de seguimiento" miga="Seguimiento › Parametrización">
        <p className="seg-ayuda">Catálogo de tipos que usan las novedades de los proyectos.</p>
      </Encabezado>

      <MensajeAccion error={error} aviso={aviso} ancla={ancla} />

      <section className="seg-card">
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
      </section>
    </div>
  )
}

export default ParametrosSeguimiento
