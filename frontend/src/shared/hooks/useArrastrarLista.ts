import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface EstadoArrastre {
  clave: string
  id: number
  ancho: number
  alto: number
  offsetX: number
  offsetY: number
  x: number
  y: number
  contenido: string
}

export interface ControladorArrastre<T> {
  arrastre: EstadoArrastre | null
  iniciar: (e: ReactPointerEvent<HTMLElement>, item: T) => void
}

/**
 * Arrastrar y soltar tipo "cuadro flotante": al agarrar el mango, el elemento
 * se despega y sigue el cursor, y la lista se reordena en vivo según sobre qué
 * fila quede el cursor. El prefijo evita que se mezclen listas distintas (p. ej.
 * subcategorías de categorías diferentes, o las pestañas de convocatorias entre sí).
 *
 * Usa listeners en window (no Pointer Capture): como la lista se reordena en
 * vivo, React mueve el nodo del mango arrastrado en el DOM en cada paso, y eso
 * libera la captura del puntero a mitad de camino, dejando el "soltar" sin disparar.
 */
export function useArrastrarLista<T>(
  prefijo: string,
  items: T[],
  obtenerId: (item: T) => number,
  obtenerTexto: (item: T) => string,
  setItems: (items: T[]) => void,
  guardarOrden: (ids: number[]) => void
): ControladorArrastre<T> {
  const itemsRef = useRef(items)
  itemsRef.current = items

  const [arrastre, setArrastre] = useState<EstadoArrastre | null>(null)
  const arrastreRef = useRef(arrastre)
  arrastreRef.current = arrastre

  const iniciar = (e: ReactPointerEvent<HTMLElement>, item: T) => {
    e.preventDefault()
    const fila = e.currentTarget.closest<HTMLElement>('[data-drag-row]')
    if (!fila) return
    const rect = fila.getBoundingClientRect()
    const id = obtenerId(item)
    setArrastre({
      clave: `${prefijo}-${id}`,
      id,
      ancho: rect.width,
      alto: rect.height,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      x: rect.left,
      y: rect.top,
      contenido: obtenerTexto(item),
    })
  }

  useEffect(() => {
    if (!arrastre) return

    const mover = (e: PointerEvent) => {
      const actual = arrastreRef.current
      if (!actual) return
      const x = e.clientX - actual.offsetX
      const y = e.clientY - actual.offsetY
      setArrastre((prev) => (prev ? { ...prev, x, y } : prev))

      const elementos = document.elementsFromPoint(e.clientX, e.clientY)
      const filaDebajo = elementos.find(
        (el): el is HTMLElement =>
          el instanceof HTMLElement &&
          !!el.dataset.dragRow &&
          el.dataset.dragRow.startsWith(`${prefijo}-`) &&
          el.dataset.dragRow !== actual.clave
      )
      if (!filaDebajo) return
      const idDebajo = Number(filaDebajo.dataset.dragRow!.slice(prefijo.length + 1))

      const actuales = itemsRef.current
      const origenIdx = actuales.findIndex((it) => obtenerId(it) === actual.id)
      const destinoIdx = actuales.findIndex((it) => obtenerId(it) === idDebajo)
      if (origenIdx === -1 || destinoIdx === -1 || origenIdx === destinoIdx) return
      const copia = [...actuales]
      const [movido] = copia.splice(origenIdx, 1)
      copia.splice(destinoIdx, 0, movido)
      setItems(copia)
    }

    const soltar = () => {
      guardarOrden(itemsRef.current.map(obtenerId))
      setArrastre(null)
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    window.addEventListener('blur', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      window.removeEventListener('blur', soltar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastre !== null])

  return { arrastre, iniciar }
}
