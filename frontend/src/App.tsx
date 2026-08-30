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
import ProgramasAcademicos from './pages/ProgramasAcademicos'
import ModalidadTipoProyecto from './pages/ModalidadTipoProyecto'
import LineasInvestigacion from './pages/LineasInvestigacion'
import FormatosEvaluacion from './pages/FormatosEvaluacion'
import Reclamaciones from './pages/Reclamaciones'
import CrearProyecto from './pages/CrearProyecto'
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
                path="/programas-academicos"
                element={
                  <RequireRole allowed={['administrador']}>
                    <ProgramasAcademicos />
                  </RequireRole>
                }
              />

              <Route
                path="/modalidad-tipo-proyecto"
                element={
                  <RequireRole allowed={['administrador']}>
                    <ModalidadTipoProyecto />
                  </RequireRole>
                }
              />

              <Route
                path="/lineas-investigacion"
                element={
                  <RequireRole allowed={['administrador']}>
                    <LineasInvestigacion />
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
                path="/reclamaciones"
                element={
                  <RequireRole allowed={['administrador']}>
                    <Reclamaciones />
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