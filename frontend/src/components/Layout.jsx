import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Plus, BarChart3, CheckSquare, Sparkles, CalendarDays, StickyNote, LogOut, User } from 'lucide-react'
import { useUser } from '../context/UserContext'
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
  const navigate = useNavigate()
  const { user, logout } = useUser()
  
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  
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
          {user && (
            <div className="user-info">
              <div className="user-avatar">
                <User size={18} />
              </div>
              <div className="user-details">
                <span className="user-name">{user.display_name || user.username}</span>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="יציאה">
                <LogOut size={18} />
              </button>
            </div>
          )}
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
