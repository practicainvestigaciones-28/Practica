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
import RequireRole from './components/RequireRole'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/recuperar-contrasena" element={<RecoverPassword />} />

        <Route element={<DashboardLayout />}>
          <Route path="/inicio" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/roles" element={<RequireRole allowed={['administrador']}><Roles /></RequireRole>}/>
          <Route path="/convocatorias" element={<Convocatorias />} />
          <Route path="/proyectos" element={<Proyectos />} />
          <Route path="/perfil" element={<Perfil />} />
        </Route>
      </Routes>
    </BrowserRouter>
    
  )
}

export default App