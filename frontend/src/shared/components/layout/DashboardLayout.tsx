import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { RealtimeProvider } from '../../realtime/RealtimeContext'
import './DashboardLayout.css'

function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <RealtimeProvider>
      <div className="dashboard-layout">
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
        <div className="dashboard-main">
          <Navbar onToggleMenu={() => setMobileMenuOpen((prev) => !prev)} />
          <div className="dashboard-content">
            <Outlet />
          </div>
        </div>
      </div>
    </RealtimeProvider>
  )
}

export default DashboardLayout