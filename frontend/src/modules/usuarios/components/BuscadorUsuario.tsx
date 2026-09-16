import { useState, useEffect, useRef } from 'react'
import { buscarUsuarios, type UsuarioBuscado } from '../api/usuarios'

interface BuscadorUsuarioProps {
  value: UsuarioBuscado | null
  onChange: (usuario: UsuarioBuscado | null) => void
  placeholder?: string

  excluidos?: number[]
}

function BuscadorUsuario({ value, onChange, placeholder, excluidos = [] }: BuscadorUsuarioProps) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<UsuarioBuscado[]>([])
  const [abierto, setAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [avisoDuplicado, setAvisoDuplicado] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)

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
