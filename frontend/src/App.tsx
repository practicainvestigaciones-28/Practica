import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import RecoverPassword from './pages/RecoverPassword'
import DashboardLayout from './components/DashboardLayout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Roles from './pages/Roles'
import Usuarios from './pages/Usuarios'
import Convocatorias from './pages/Convocatorias'
import Proyectos from './pages/Proyectos'
import Perfil from './pages/Perfil'
import AreaConocimiento from './pages/AreaConocimiento'
import FormatosEvaluacion from './pages/FormatosEvaluacion'
import Asignaciones from './pages/Asignaciones'
import ComiteEtica from './pages/ComiteEtica'
import Evaluaciones from './pages/Evaluaciones'
import FormularioCalificacion from './pages/FormularioCalificacion'
import InformacionPagos from './pages/InformacionPagos'
import CrearProyecto from './pages/CrearProyecto'
import VerProyecto from './pages/VerProyecto'
import Observaciones from './pages/Observaciones'
import NotificacionDetalle from './pages/NotificacionDetalle'
import RequireRole from './components/RequireRole'
import ProtectedRoute from './components/ProtectedRoute'

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

              {/* Convocatorias ahora incluye, en pestañas: Convocatorias, Períodos,
                  Programas académicos y Líneas de investigación */}
              <Route
                path="/convocatorias"
                element={
                  <RequireRole allowed={['administrador']}>
                    <Convocatorias />
                  </RequireRole>
                }
              />

              {/* Formatos de evaluación ahora incluye, en pestañas: Formatos de
                  evaluación (Etapas) y Reclamaciones */}
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
                  <RequireRole allowed={['administrador']}>
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