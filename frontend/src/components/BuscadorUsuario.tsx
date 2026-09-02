import { useState, useEffect, useRef } from 'react'
import { buscarUsuarios, type UsuarioBuscado } from '../api/usuarios'

interface BuscadorUsuarioProps {
  value: UsuarioBuscado | null
  onChange: (usuario: UsuarioBuscado | null) => void
  placeholder?: string
  /** ids de usuarios ya elegidos en OTRO campo del formulario — no se pueden repetir */
  excluidos?: number[]
}

/**
 * Autocompletar de usuarios reales. Guarda por debajo el id_usuario real
 * (necesario para /participantes), aunque en pantalla se vea como un campo
 * de texto normal. Escribe al menos 2 letras para que empiece a buscar.
 *
 * El texto que se ve en el campo NUNCA se guarda en un estado propio del
 * componente — mientras hay un usuario seleccionado (value), el texto se
 * calcula directo de ese valor en cada render. Así, aunque el componente
 * se desmonte y se vuelva a montar (por ejemplo al cambiar de pestaña en
 * Crear Proyecto), el nombre sigue apareciendo, porque no depende de un
 * estado local que se pueda perder — depende del dato real del padre.
 *
 * Reglas:
 * - No se puede repetir un usuario que ya esté elegido en otro campo (se
 *   oculta de los resultados y se avisa si lo intentas).
 * - Si escribes texto y no seleccionas nada de la lista, el campo se
 *   limpia solo al salir — no se puede dejar un nombre "a mano".
 */
function BuscadorUsuario({ value, onChange, placeholder, excluidos = [] }: BuscadorUsuarioProps) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<UsuarioBuscado[]>([])
  const [abierto, setAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [avisoDuplicado, setAvisoDuplicado] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Lo que se ve en el input: si hay un usuario real seleccionado, se
  // muestra su nombre (calculado, no guardado); si no, lo que se esté
  // escribiendo en ese momento.
  const textoVisible = value ? `${value.nombre} ${value.apellido}` : query

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
        if (!value) setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [value])

  useEffect(() => {
    if (value || query.trim().length < 2) {
      setResultados([])
      return
    }
    setBuscando(true)
    const timeoutId = setTimeout(() => {
      buscarUsuarios(query.trim())
        .then((res) => setResultados(res.filter((u) => !excluidos.includes(u.id_usuario))))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [query, value, excluidos])

  const handleSeleccionar = (usuario: UsuarioBuscado) => {
    if (excluidos.includes(usuario.id_usuario)) {
      setAvisoDuplicado(true)
      setTimeout(() => setAvisoDuplicado(false), 2500)
      return
    }
    onChange(usuario)
    setQuery('')
    setAbierto(false)
  }

  const handleChangeTexto = (nuevoTexto: string) => {
    if (value) onChange(null)
    setQuery(nuevoTexto)
    setAbierto(true)
  }

  const handleBlur = () => {
    // Se da un pequeño margen para que un clic en un resultado alcance a
    // registrarse antes de decidir si hay que limpiar el texto escrito.
    setTimeout(() => {
      if (!value) setQuery('')
    }, 150)
  }

  return (
    <div className="cp-buscador-usuario" ref={contenedorRef}>
      <input
        type="text"
        value={textoVisible}
        onChange={(e) => handleChangeTexto(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={handleBlur}
        placeholder={placeholder ?? 'Escribe un nombre o correo...'}
        autoComplete="off"
      />
      {avisoDuplicado && <p className="cp-buscador-aviso">Ese usuario ya está seleccionado en otro campo.</p>}
      {abierto && !value && query.trim().length >= 2 && (
        <div className="cp-buscador-dropdown">
          {buscando && <div className="cp-buscador-item cp-buscador-vacio">Buscando...</div>}
          {!buscando && resultados.length === 0 && (
            <div className="cp-buscador-item cp-buscador-vacio">Sin coincidencias</div>
          )}
          {!buscando &&
            resultados.map((u) => (
              <button
                type="button"
                key={u.id_usuario}
                className="cp-buscador-item"
                onClick={() => handleSeleccionar(u)}
              >
                <strong>{u.nombre} {u.apellido}</strong>
                <span>{u.correo}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default BuscadorUsuario
