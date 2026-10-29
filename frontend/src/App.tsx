import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './modules/auth/context/AuthContext'
import Login from './modules/auth/pages/Login'
import RecoverPassword from './modules/auth/pages/RecoverPassword'
import SeleccionarRol from './modules/auth/pages/SeleccionarRol'
import CambiarContrasenaInicial from './modules/auth/pages/CambiarContrasenaInicial'
import AceptarTratamientoDatos from './modules/auth/pages/AceptarTratamientoDatos'
import DashboardLayout from './shared/components/layout/DashboardLayout'
import Home from './modules/dashboard/pages/Home'
import Dashboard from './modules/dashboard/pages/Dashboard'
import Usuarios from './modules/usuarios/pages/Usuarios'
import Convocatorias from './modules/convocatorias/pages/Convocatorias'
import Proyectos from './modules/proyectos/pages/Proyectos'
import Perfil from './modules/usuarios/pages/Perfil'
import FormatosEvaluacion from './modules/catalogos/pages/FormatosEvaluacion'
import Asignaciones from './modules/comite-etica/pages/Asignaciones'
import ComiteEtica from './modules/comite-etica/pages/ComiteEtica'
import ComiteInvestigacion from './modules/comite-investigacion/pages/ComiteInvestigacion'
import FormularioCalificacion from './modules/evaluaciones/pages/FormularioCalificacion'
import InformacionPagos from './modules/evaluaciones/pages/InformacionPagos'
import HistorialPagos from './modules/evaluaciones/pages/HistorialPagos'
import PagosPares from './modules/evaluaciones/pages/PagosPares'
import CrearProyecto from './modules/proyectos/pages/CrearProyecto'
import VerProyecto from './modules/proyectos/pages/VerProyecto'
import NotificacionDetalle from './modules/proyectos/pages/NotificacionDetalle'
import SeguimientoProyectos from './modules/lider/pages/SeguimientoProyectos'
import MiGrupoInvestigacion from './modules/lider/pages/MiGrupoInvestigacion'
import ActasInicio from './modules/acta-inicio/pages/ActasInicio'
import ActaInicioDetalle from './modules/acta-inicio/pages/ActaInicioDetalle'
import FirmarActaPorEnlace from './modules/acta-inicio/pages/FirmarActaPorEnlace'
import FirmarProyectoPorEnlace from './modules/proyectos/pages/FirmarProyectoPorEnlace'
import ProyectosSeguimiento from './modules/seguimiento/pages/ProyectosSeguimiento'
import SeguimientoProyecto from './modules/seguimiento/pages/SeguimientoProyecto'
import BandejasSeguimiento from './modules/seguimiento/pages/BandejasSeguimiento'
import ParametrosSeguimiento from './modules/seguimiento/pages/ParametrosSeguimiento'
import ConsolidadoInstitucional from './modules/seguimiento/pages/ConsolidadoInstitucional'
import RequireRole from './modules/auth/components/RequireRole'
import ProtectedRoute from './modules/auth/components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/recuperar-contrasena" element={<RecoverPassword />} />
          {/* Enlace personal del correo: firma el acta de inicio sin iniciar sesión. */}
          <Route path="/firmar-acta/:token" element={<FirmarActaPorEnlace />} />
          {/* Enlace personal del correo: firma la participación en el registro del proyecto sin iniciar sesión. */}
          <Route path="/firmar-proyecto/:token" element={<FirmarProyectoPorEnlace />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/cambiar-contrasena-inicial" element={<CambiarContrasenaInicial />} />
            <Route path="/aceptar-tratamiento-datos" element={<AceptarTratamientoDatos />} />
            <Route path="/elegir-rol" element={<SeleccionarRol />} />

            <Route element={<DashboardLayout />}>
              <Route path="/inicio" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/proyectos" element={<Proyectos />} />
              <Route path="/proyectos/nuevo" element={<CrearProyecto />} />
              <Route path="/proyectos/editar/:id" element={<CrearProyecto />} />
              <Route path="/proyectos/ver/:id" element={<VerProyecto />} />
              <Route path="/notificacion" element={<NotificacionDetalle />} />
              <Route path="/perfil" element={<Perfil />} />

              <Route
                path="/usuarios"
                element={
                  <RequireRole allowed={['administrador']}>
                    <Usuarios />
                  </RequireRole>
                }
              />

              <Route
                path="/convocatorias"
                element={
                  <RequireRole allowed={['administrador']}>
                    <Convocatorias />
                  </RequireRole>
                }
              />

              <Route
                path="/formatos-evaluacion"
                element={
                  <RequireRole allowed={['administrador']}>
                    <FormatosEvaluacion />
                  </RequireRole>
                }
              />

              <Route
                path="/asignaciones"
                element={
                  <RequireRole allowed={['administrador']}>
                    <Asignaciones />
                  </RequireRole>
                }
              />

              <Route
                path="/comite-etica"
                element={
                  <RequireRole allowed={['comite_etica']}>
                    <ComiteEtica />
                  </RequireRole>
                }
              />

              <Route
                path="/comite-investigacion"
                element={
                  <RequireRole allowed={['comite_investigacion']}>
                    <ComiteInvestigacion />
                  </RequireRole>
                }
              />

              <Route
                path="/evaluaciones/calificar"
                element={
                  <RequireRole allowed={['par_evaluador']}>
                    <FormularioCalificacion />
                  </RequireRole>
                }
              />

              <Route
                path="/informacion-pagos"
                element={
                  <RequireRole allowed={['par_evaluador']}>
                    <InformacionPagos />
                  </RequireRole>
                }
              />

              <Route
                path="/historial-pagos"
                element={
                  <RequireRole allowed={['par_evaluador']}>
                    <HistorialPagos />
                  </RequireRole>
                }
              />

              <Route
                path="/pagos-pares"
                element={
                  <RequireRole allowed={['administrador']}>
                    <PagosPares />
                  </RequireRole>
                }
              />

              <Route
                path="/seguimiento-proyectos"
                element={
                  <RequireRole allowed={['lider']}>
                    <SeguimientoProyectos />
                  </RequireRole>
                }
              />
              <Route
                path="/mi-grupo"
                element={
                  <RequireRole allowed={['lider']}>
                    <MiGrupoInvestigacion />
                  </RequireRole>
                }
              />

              {/* EP-15: el administrador crea y genera, el investigador firma y el Vicerrector firma de último. */}
              <Route
                path="/acta-inicio"
                element={
                  <RequireRole allowed={['administrador', 'usuario', 'vicerrector']}>
                    <ActasInicio />
                  </RequireRole>
                }
              />

              <Route
                path="/acta-inicio/:id"
                element={
                  <RequireRole allowed={['administrador', 'usuario', 'vicerrector']}>
                    <ActaInicioDetalle />
                  </RequireRole>
                }
              />

              {/* Etapa de seguimiento, ejecución y cierre (M-02 a M-08), continuación del acta de inicio. */}
              <Route
                path="/seguimiento"
                element={
                  <RequireRole allowed={['administrador', 'usuario', 'vicerrector', 'lider']}>
                    <ProyectosSeguimiento />
                  </RequireRole>
                }
              />

              <Route
                path="/seguimiento/:id"
                element={
                  <RequireRole allowed={['administrador', 'usuario', 'vicerrector', 'lider']}>
                    <SeguimientoProyecto />
                  </RequireRole>
                }
              />

              <Route
                path="/seguimiento/bandejas"
                element={
                  <RequireRole allowed={['administrador']}>
                    <BandejasSeguimiento />
                  </RequireRole>
                }
              />

              <Route
                path="/seguimiento/parametros"
                element={
                  <RequireRole allowed={['administrador']}>
                    <ParametrosSeguimiento />
                  </RequireRole>
                }
              />

              <Route
                path="/seguimiento/consolidado"
                element={
                  <RequireRole allowed={['administrador', 'vicerrector']}>
                    <ConsolidadoInstitucional />
                  </RequireRole>
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App