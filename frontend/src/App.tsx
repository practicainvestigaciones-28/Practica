import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import RecoverPassword from './pages/RecoverPassword'
import DashboardLayout from './components/DashboardLayout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Roles from './pages/Roles'
import Convocatorias from './pages/Convocatorias'
import Proyectos from './pages/Proyectos'
import Perfil from './pages/Perfil'
import AreaConocimiento from './pages/AreaConocimiento'
import RequireRole from './components/RequireRole'
import ProtectedRoute from './components/ProtectedRoute'
import CrearProyecto from './pages/CrearProyecto'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/recuperar-contrasena" element={<RecoverPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/inicio" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/proyectos/nuevo" element={<CrearProyecto />} />
            <Route path="/convocatorias" element={<Convocatorias />} />
            <Route path="/perfil" element={<Perfil />} />

            <Route
              path="/roles"
              element={
                <RequireRole allowed={['Administrador']}>
                  <Roles />
                </RequireRole>
              }
            />

            <Route
              path="/area-conocimiento"
              element={
                <RequireRole allowed={['Administrador']}>
                  <AreaConocimiento />
                </RequireRole>
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App