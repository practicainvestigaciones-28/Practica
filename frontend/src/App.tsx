import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './modules/auth/context/AuthContext'
import Login from './modules/auth/pages/Login'
import RecoverPassword from './modules/auth/pages/RecoverPassword'
import DashboardLayout from './shared/components/layout/DashboardLayout'
import Home from './modules/dashboard/pages/Home'
import Dashboard from './modules/dashboard/pages/Dashboard'
import Roles from './modules/usuarios/pages/Roles'
import Usuarios from './modules/usuarios/pages/Usuarios'
import Convocatorias from './modules/convocatorias/pages/Convocatorias'
import Proyectos from './modules/proyectos/pages/Proyectos'
import Perfil from './modules/usuarios/pages/Perfil'
import AreaConocimiento from './modules/convocatorias/pages/AreaConocimiento'
import FormatosEvaluacion from './modules/catalogos/pages/FormatosEvaluacion'
import Asignaciones from './modules/comite-etica/pages/Asignaciones'
import ComiteEtica from './modules/comite-etica/pages/ComiteEtica'
import Evaluaciones from './modules/evaluaciones/pages/Evaluaciones'
import FormularioCalificacion from './modules/evaluaciones/pages/FormularioCalificacion'
import InformacionPagos from './modules/evaluaciones/pages/InformacionPagos'
import CrearProyecto from './modules/proyectos/pages/CrearProyecto'
import VerProyecto from './modules/proyectos/pages/VerProyecto'
import Observaciones from './modules/proyectos/pages/Observaciones'
import NotificacionDetalle from './modules/proyectos/pages/NotificacionDetalle'
import RequireRole from './modules/auth/components/RequireRole'
import ProtectedRoute from './modules/auth/components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/recuperar-contrasena" element={<RecoverPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/inicio" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/proyectos" element={<Proyectos />} />
              <Route path="/proyectos/nuevo" element={<CrearProyecto />} />
              <Route path="/proyectos/ver/:id" element={<VerProyecto />} />
              <Route path="/proyectos/observaciones" element={<Observaciones />} />
              <Route path="/notificacion" element={<NotificacionDetalle />} />
              <Route path="/perfil" element={<Perfil />} />

              <Route
                path="/roles"
                element={
                  <RequireRole allowed={['administrador']}>
                    <Roles />
                  </RequireRole>
                }
              />

              <Route
                path="/usuarios"
                element={
                  <RequireRole allowed={['administrador']}>
                    <Usuarios />
                  </RequireRole>
                }
              />

              <Route
                path="/area-conocimiento"
                element={
                  <RequireRole allowed={['administrador']}>
                    <AreaConocimiento />
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
                path="/evaluaciones"
                element={
                  <RequireRole allowed={['par_evaluador']}>
                    <Evaluaciones />
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
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App