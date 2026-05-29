import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Upload, ClipboardList,
  History, MapPin, Settings, LogOut, Leaf, Menu, X
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload Center', icon: Upload },
  { to: '/review', label: 'Review Queue', icon: ClipboardList },
  { to: '/audit', label: 'Audit History', icon: History },
  { to: '/facilities', label: 'Facility Mapping', icon: MapPin },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Leaf size={15} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Breathe ESG
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
              Data Platform
            </div>
          </div>
        </div>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          style={{
            display: 'none',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}
          className="sidebar-close-btn"
        >
          <X size={16} />
        </button>
      </div>

      {/* Org badge */}
      {user?.organization_name && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{
            background: 'var(--accent-subtle)',
            border: '1px solid #2a2a45',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 11,
            color: 'var(--accent-hover)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.organization_name}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'white',
        }}>
          {user?.avatar_initials || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.first_name || user?.username}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {user?.role}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, borderRadius: 4,
            display: 'flex', alignItems: 'center',
          }}
          title="Logout"
        >
          <LogOut size={13} />
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        style={{
          display: 'none',
          position: 'fixed', top: 14, left: 14, zIndex: 200,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: 8, cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
        className="sidebar-hamburger"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            display: 'none',
            position: 'fixed', inset: 0, zIndex: 99,
            background: 'rgba(0,0,0,0.6)',
          }}
          className="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: 210, minWidth: 210,
          height: '100vh',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          zIndex: 100,
        }}
        className="sidebar-desktop"
      >
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <aside
        style={{
          display: 'none',
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 210, zIndex: 100,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          flexDirection: 'column',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        }}
        className="sidebar-mobile"
      >
        <SidebarContent />
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile { display: flex !important; }
          .sidebar-hamburger { display: flex !important; }
          .sidebar-overlay { display: block !important; }
          .sidebar-close-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
