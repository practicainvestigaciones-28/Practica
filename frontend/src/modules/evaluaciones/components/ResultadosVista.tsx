import type { CategoriaResultado } from '../../proyectos/lib/resultadosEsperados'
import './DatosGeneralesVista.css'

/** Resultados esperados: una tarjeta por categoría con sus subcategorías y tipos, en el orden del formulario. */
function ResultadosVista({ categorias }: { categorias: CategoriaResultado[] }) {
  return (
    <div className="dgv-resultados">
      {categorias.map((cat) => (
        <div className="dgv-participante" key={cat.nombre}>
          <div className="dgv-participante-encabezado">
            <span className="dgv-participante-nombre">{cat.nombre}</span>
            <span className="dgv-participante-rol">
              {cat.total} {cat.total === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          {cat.subcategorias.map((sub) => (
            <div className="dgv-resultado-sub" key={sub.nombre}>
              <span className="dgv-resultado-sub-nombre">{sub.nombre}</span>
              {sub.tipos.map((tipo) => (
                <div className="dgv-resultado-fila" key={tipo.nombre}>
                  <span>{tipo.nombre}</span>
                  <span className="dgv-resultado-cantidad">{tipo.cantidad}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default ResultadosVista
