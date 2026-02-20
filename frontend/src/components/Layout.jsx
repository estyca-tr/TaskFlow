import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Plus, BarChart3, CheckSquare, Sparkles, CalendarDays, StickyNote } from 'lucide-react'
import './Layout.css'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'לוח בקרה', exact: true },
  { path: '/tasks', icon: CheckSquare, label: 'משימות' },
  { path: '/daily-meetings', icon: CalendarDays, label: 'הכנה לישיבות' },
  { path: '/notes', icon: StickyNote, label: 'פתקים' },
  { path: '/people', icon: Users, label: 'אנשים' },
  { path: '/meetings/new', icon: Plus, label: 'פגישה חדשה' },
  { path: '/analytics', icon: BarChart3, label: 'אנליטיקס' },
]

function Layout() {
  const location = useLocation()
  
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Sparkles size={24} />
            </div>
            <div className="logo-text">
              <span className="logo-title">TaskFlow</span>
              <span className="logo-subtitle">ניהול משימות חכם</span>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.exact 
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path)
            
            return (
              <NavLink 
                key={item.path}
                to={item.path} 
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <Icon size={20} />
                </span>
                <span className="nav-label">{item.label}</span>
                {isActive && <span className="nav-indicator" />}
              </NavLink>
            )
          })}
        </nav>
        
        <div className="sidebar-footer">
          <div className="footer-card">
            <p className="footer-text">צריכה עזרה?</p>
            <a href="#" className="footer-link">מדריך למשתמש</a>
          </div>
          <p className="version">גרסה 2.0</p>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
