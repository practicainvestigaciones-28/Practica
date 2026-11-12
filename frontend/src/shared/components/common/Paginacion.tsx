import { ChevronLeft, ChevronRight } from 'lucide-react'
import './Paginacion.css'

/** Flechas "‹ 2 de 5 ›" bajo una lista; no se muestra si cabe todo en una sola página. */
function Paginacion({ pagina, totalPaginas, onCambiar }: { pagina: number; totalPaginas: number; onCambiar: (n: number) => void }) {
  if (totalPaginas <= 1) return null
  return (
    <div className="paginacion">
      <button type="button" className="paginacion-btn" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        <ChevronLeft size={16} />
      </button>
      <span className="paginacion-texto">
        {pagina} de {totalPaginas}
      </span>
      <button type="button" className="paginacion-btn" aria-label="Página siguiente" disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export default Paginacion
