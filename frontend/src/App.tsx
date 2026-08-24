import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext' // <-- 1. Importa el Provider (ajusta la ruta si está en otra carpeta)
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
import CrearProyecto from './pages/CrearProyecto'
import Observaciones from './pages/Observaciones'
import RequireRole from './components/RequireRole'

function App() {
  return (
    <BrowserRouter>
      {/* 2. Envuelve las rutas con el AuthProvider */}
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/recuperar-contrasena" element={<RecoverPassword />} />

          <Route element={<DashboardLayout />}>
            <Route path="/inicio" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/proyectos/nuevo" element={<CrearProyecto />} />
            <Route path="/proyectos/observaciones" element={<Observaciones />} />
            <Route path="/convocatorias" element={<Convocatorias />} />
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
              path="/area-conocimiento"
              element={
                <RequireRole allowed={['administrador']}>
                  <AreaConocimiento />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App