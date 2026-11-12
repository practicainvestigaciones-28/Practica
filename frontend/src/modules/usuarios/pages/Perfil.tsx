import { useEffect, useRef, useState } from 'react'
import { Save, User, Camera, Pencil, X as XIcon } from 'lucide-react'
import { getRole } from '../../auth/lib/auth'
import { useAuth } from '../../auth/context/AuthContext'
import * as authApi from '../../auth/api/auth'
import * as usuariosApi from '../api/usuarios'
import * as fotoPerfilApi from '../api/fotoPerfil'
import { ApiError } from '../../../shared/api/client'
import './Perfil.css'

interface DatosPerfilForm {
  nombre: string
  apellido: string
  cedula: string
  correo: string
}

function Perfil() {
  const { usuario, actualizarUsuarioSesion } = useAuth()

  const role = getRole()
  const isAdmin = role === 'administrador'
  // Solo una cuenta de Administrador cambia sus datos personales; los demás roles solo su correo personal
  // (el backend lo exige igual, ver actualizarPerfil en auth.controller.ts).
  const puedeEditarDatos = Boolean(usuario?.roles.includes('Administrador'))

  // La foto guardada en el servidor; se refresca sola al subirla o quitarla.
  const avatarUrl = fotoPerfilApi.useFotoPerfil()
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<DatosPerfilForm>({
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    cedula: usuario?.cedula ?? '',
    correo: usuario?.correo ?? '',
  })
  // Solo Administrador: su cargo sale en el sello "Elaborado por" / "Revisado por" de actas e informes.
  const [cargoActual, setCargoActual] = useState('')
  const [cargoGuardado, setCargoGuardado] = useState('')
  // Correo personal de quien firma (hoja de vida): ahí llegan los enlaces de firma y el código de verificación; sin él no se firma.
  const [correoPersonal, setCorreoPersonal] = useState('')
  const [correoPersonalGuardado, setCorreoPersonalGuardado] = useState('')
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [exitoGuardar, setExitoGuardar] = useState(false)

  // Si el perfil del contexto cambia (ej. recién cargó tras el login), que el
  // formulario refleje esos valores en vez de quedarse con los campos vacíos
  // con los que se montó el componente la primera vez.
  useEffect(() => {
    if (!usuario) return
    setForm({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      cedula: usuario.cedula ?? '',
      correo: usuario.correo,
    })
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    let vigente = true
    usuariosApi
      .obtenerHojaVida(usuario.id_usuario)
      .then((h) => {
        if (!vigente) return
        setCargoActual(h.cargo_actual ?? '')
        setCargoGuardado(h.cargo_actual ?? '')
        setCorreoPersonal(h.correo_personal ?? '')
        setCorreoPersonalGuardado(h.correo_personal ?? '')
      })
      .catch(() => {
        // Sin hoja de vida todavía: el cargo y el correo personal quedan por diligenciar.
      })
    return () => {
      vigente = false
    }
  }, [usuario])

  const actualizarCampo = (campo: keyof DatosPerfilForm, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setExitoGuardar(false)
  }

  const handleActivarEdicion = () => {
    setErrorGuardar('')
    setExitoGuardar(false)
    setEditando(true)
  }

  const handleCancelarEdicion = () => {
    if (usuario) {
      setForm({
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        cedula: usuario.cedula ?? '',
        correo: usuario.correo,
      })
    }
    setCargoActual(cargoGuardado)
    setCorreoPersonal(correoPersonalGuardado)
    setErrorGuardar('')
    setEditando(false)
  }

  const handleGuardarPerfil = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setErrorGuardar('Nombre y apellido son obligatorios.')
      return
    }
    if (!correoPersonal.trim()) {
      setErrorGuardar('El correo personal es obligatorio: sin él no puedes firmar actas ni informes.')
      return
    }
    setGuardando(true)
    setErrorGuardar('')
    try {
      const actualizado = puedeEditarDatos
        ? (
            await authApi.actualizarPerfil({
              nombre: form.nombre.trim(),
              apellido: form.apellido.trim(),
              cedula: form.cedula.trim() || undefined,
            })
          ).usuario
        : usuario
      if (!actualizado) return
      await usuariosApi.guardarHojaVida(actualizado.id_usuario, {
        correo_personal: correoPersonal.trim() || null,
        ...(isAdmin ? { cargo_actual: cargoActual.trim() || null } : {}),
      })
      setCorreoPersonalGuardado(correoPersonal.trim())
      if (isAdmin) setCargoGuardado(cargoActual.trim())
      if (puedeEditarDatos) actualizarUsuarioSesion(actualizado)
      setExitoGuardar(true)
      setEditando(false)
    } catch (err) {
      setErrorGuardar(err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil.')
    } finally {
      setGuardando(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Permite volver a elegir el mismo archivo después.
    e.target.value = ''
    if (!file) return
    if (!fotoPerfilApi.TIPOS_FOTO_PERFIL.includes(file.type)) {
      setErrorFoto('La foto debe ser una imagen JPG, PNG o WebP.')
      return
    }
    if (file.size > fotoPerfilApi.TAMANO_MAXIMO_FOTO_BYTES) {
      setErrorFoto('La foto no puede pesar más de 5 MB.')
      return
    }
    setErrorFoto('')
    setSubiendoFoto(true)
    try {
      await fotoPerfilApi.subirFotoPerfil(file)
    } catch (err) {
      setErrorFoto(err instanceof ApiError ? err.message : 'No se pudo guardar la foto.')
    } finally {
      setSubiendoFoto(false)
    }
  }

  const handleQuitarFoto = async () => {
    setErrorFoto('')
    setSubiendoFoto(true)
    try {
      await fotoPerfilApi.quitarFotoPerfil()
    } catch (err) {
      setErrorFoto(err instanceof ApiError ? err.message : 'No se pudo quitar la foto.')
    } finally {
      setSubiendoFoto(false)
    }
  }


  return (
    <div className="perfil-card">
      <div className="perfil-banner">
        <div className="perfil-banner-shape" />
        <img src="/SGP.png" alt="SGP-VIE" className="perfil-banner-logo" />
      </div>

      <div className="perfil-avatar-wrapper">
        <div className="perfil-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Foto de perfil" className="perfil-avatar-img" />
          ) : (
            <User className="perfil-avatar-icon" strokeWidth={1.5} />
          )}
        </div>

        <button
          type="button"
          className="perfil-avatar-edit"
          onClick={handleAvatarClick}
          aria-label="Cambiar foto de perfil"
          title="Cambiar foto de perfil"
          disabled={subiendoFoto}
        >
          <Camera size={14} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="perfil-avatar-input"
          onChange={handleAvatarChange}
        />
      </div>

      {(avatarUrl || subiendoFoto || errorFoto) && (
        <div className="perfil-foto-estado">
          {subiendoFoto && <span>Guardando foto...</span>}
          {!subiendoFoto && avatarUrl && (
            <button type="button" className="perfil-foto-quitar" onClick={handleQuitarFoto}>
              Quitar foto
            </button>
          )}
          {errorFoto && <span className="perfil-foto-error">{errorFoto}</span>}
        </div>
      )}

      <p className="perfil-username">
      {usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario'}
      </p>

      <div className="perfil-tabs">
        <span className="perfil-tab perfil-tab-active perfil-tab-static">Información personal</span>
      </div>

      <div className="perfil-content">
        <form
          className="perfil-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleGuardarPerfil()
          }}
        >
          <div className="perfil-field">
            <label>Nombre</label>
            <input type="text" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} readOnly={!editando || !puedeEditarDatos} disabled={!puedeEditarDatos} />
          </div>
          <div className="perfil-field">
            <label>Apellido</label>
            <input type="text" value={form.apellido} onChange={(e) => actualizarCampo('apellido', e.target.value)} readOnly={!editando || !puedeEditarDatos} disabled={!puedeEditarDatos} />
          </div>
          <div className="perfil-field">
            <label>Cédula</label>
            <input type="text" value={form.cedula} onChange={(e) => actualizarCampo('cedula', e.target.value)} readOnly={!editando || !puedeEditarDatos} disabled={!puedeEditarDatos} />
          </div>
          <div className="perfil-field">
            {/* Es el usuario con el que se inicia sesión: no se cambia desde el perfil (solo el Administrador, en Usuarios). */}
            <label>Correo de inicio de sesión</label>
            <input type="email" value={form.correo} readOnly disabled title="El correo de inicio de sesión no se puede cambiar desde el perfil" />
          </div>

          {isAdmin && (
            <div className="perfil-field perfil-field-ancho">
              <label>Cargo actual</label>
              <input
                type="text"
                value={cargoActual}
                placeholder="Ej. Analista de Investigación"
                onChange={(e) => {
                  setCargoActual(e.target.value)
                  setExitoGuardar(false)
                }}
                readOnly={!editando}
              />
              <small className="perfil-field-nota">Aparece con tu nombre en el sello de las actas e informes.</small>
            </div>
          )}

            <div className="perfil-field perfil-field-ancho">
              <label>Correo personal (obligatorio para firmar)</label>
              <input
                type="email"
                placeholder="nombre@gmail.com"
                value={correoPersonal}
                onChange={(e) => {
                  setCorreoPersonal(e.target.value)
                  setExitoGuardar(false)
                }}
                readOnly={!editando}
              />
              <small className="perfil-field-nota">Es obligatorio para poder firmar: ahí te llegan los enlaces de firma y el código de verificación de actas e informes.</small>
            </div>

          {!isAdmin && (
            <div className="perfil-field perfil-field-ancho">
              <label>Rol</label>
              <input
                type="text"
                value={usuario?.roles?.join(', ') ?? ''}
                readOnly
                title="Para cambiar tu rol, contacta al Administrador."
              />
            </div>
          )}

          <div className="perfil-form-pie">
            {errorGuardar && <p className="perfil-form-error">{errorGuardar}</p>}
            {exitoGuardar && <p className="perfil-form-exito">Datos actualizados correctamente.</p>}

            {editando ? (
              <div className="perfil-form-acciones">
                <button type="button" className="perfil-cancelar-btn" onClick={handleCancelarEdicion} disabled={guardando}>
                  <XIcon size={16} />
                  Cancelar
                </button>
                <button type="submit" className="perfil-save-btn" disabled={guardando}>
                  <Save size={16} />
                  {guardando ? 'Guardando...' : 'Actualizar datos'}
                </button>
              </div>
            ) : (
              <button type="button" className="perfil-save-btn" onClick={handleActivarEdicion}>
                <Pencil size={16} />
                Editar datos
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default Perfil