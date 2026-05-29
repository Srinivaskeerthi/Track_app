import Sidebar from './Sidebar'

export default function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}>
        <div className="animate-fade-in" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 32px',
          overflow: 'auto',
        }}>
          {children}
        </div>
      </main>
    </div>
  )
}
