import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  const [posicion, setPosicion] = useState<{ top: number; left: number; width: number } | null>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const textoVisible = value ? `${value.nombre} ${value.apellido}` : query

  // El campo suele vivir dentro de tablas con scroll horizontal (p. ej. el
  // cronograma): si el dropdown fuera hijo directo del campo, ese `overflow`
  // lo recortaría. Se saca por portal a <body> y se posiciona en base a las
  // coordenadas reales del input, recalculándolas mientras esté abierto.
  useEffect(() => {
    if (!abierto) return

    const actualizarPosicion = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (rect) setPosicion({ top: rect.bottom, left: rect.left, width: rect.width })
    }

    actualizarPosicion()
    window.addEventListener('scroll', actualizarPosicion, true)
    window.addEventListener('resize', actualizarPosicion)
    return () => {
      window.removeEventListener('scroll', actualizarPosicion, true)
      window.removeEventListener('resize', actualizarPosicion)
    }
  }, [abierto])

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      const objetivo = e.target as Node
      // El dropdown vive en un portal fuera de contenedorRef, así que hay que
      // revisarlo aparte para no cerrarlo antes de que el click en un resultado
      // llegue a dispararse.
      const dentro =
        contenedorRef.current?.contains(objetivo) || dropdownRef.current?.contains(objetivo)
      if (!dentro) {
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
        ref={inputRef}
        type="text"
        value={textoVisible}
        onChange={(e) => handleChangeTexto(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={handleBlur}
        placeholder={placeholder ?? 'Escribe un nombre o correo...'}
        autoComplete="off"
      />
      {avisoDuplicado && <p className="cp-buscador-aviso">Ese usuario ya está seleccionado en otro campo.</p>}
      {abierto &&
        !value &&
        query.trim().length >= 2 &&
        posicion &&
        createPortal(
          <div
            className="cp-buscador-dropdown"
            ref={dropdownRef}
            style={{ position: 'fixed', top: posicion.top, left: posicion.left, width: posicion.width }}
          >
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
          </div>,
          document.body
        )}
    </div>
  )
}

export default BuscadorUsuario
