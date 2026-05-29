import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UploadCenter from './pages/UploadCenter'
import ReviewQueue from './pages/ReviewQueue'
import RecordDetail from './pages/RecordDetail'
import AuditHistory from './pages/AuditHistory'
import FacilityMapping from './pages/FacilityMapping'
import Settings from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid var(--border)',
        borderTop: '2px solid var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadCenter /></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><ReviewQueue /></ProtectedRoute>} />
            <Route path="/records/:id" element={<ProtectedRoute><RecordDetail /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute><AuditHistory /></ProtectedRoute>} />
            <Route path="/facilities" element={<ProtectedRoute><FacilityMapping /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
