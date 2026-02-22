import { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Plus, BarChart3, CheckSquare, Sparkles, CalendarDays, StickyNote, LogOut, User, X } from 'lucide-react'
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
  const [showUserMenu, setShowUserMenu] = useState(false)
  
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
          
          {/* Mobile user button in nav */}
          <button 
            className="nav-link mobile-nav-user-btn"
            onClick={() => setShowUserMenu(true)}
          >
            <span className="nav-icon user-icon">
              <User size={20} />
            </span>
            <span className="nav-label">חשבון</span>
          </button>
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
      
      {/* Mobile Header with User */}
      <div 
        className="mobile-header"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 999,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
        }}
      >
        <span style={{ color: '#FFD000', fontWeight: 600, fontSize: '1.1rem' }}>TaskFlow</span>
        <button 
          onClick={() => setShowUserMenu(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 208, 0, 0.15)',
            border: '1px solid rgba(255, 208, 0, 0.3)',
            borderRadius: '20px',
            padding: '0.5rem 0.75rem',
            color: '#FFD000',
            cursor: 'pointer',
          }}
        >
          <User size={18} />
          <span style={{ fontSize: '0.85rem' }}>{user?.username?.slice(0, 6) || 'חשבון'}</span>
        </button>
      </div>
      
      <main className="main-content">
        <Outlet />
      </main>
      
      {/* Mobile User Menu */}
      {showUserMenu && (
        <div className="mobile-user-overlay" onClick={() => setShowUserMenu(false)}>
          <div className="mobile-user-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h3>חשבון</h3>
              <button className="close-menu" onClick={() => setShowUserMenu(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="mobile-user-info">
              <div className="mobile-user-avatar">
                <User size={24} />
              </div>
              <div className="mobile-user-details">
                <span className="mobile-user-name">{user?.display_name || user?.username}</span>
                <span className="mobile-user-label">מחובר/ת</span>
              </div>
            </div>
            
            <button className="mobile-logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
              התנתק/י
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout
