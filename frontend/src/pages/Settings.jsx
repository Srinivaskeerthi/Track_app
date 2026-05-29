import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import AppLayout from '../components/AppLayout'
import { PageHeader } from '../components/ui'

export default function Settings() {
  const { user } = useAuth()
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saved, setSaved] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (data) => api.patch('/auth/me/', data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000) },
  })

  return (
    <AppLayout>
      <PageHeader title="Settings" subtitle="Account and organization settings" />

      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Profile */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Profile
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: 'white',
            }}>
              {user?.avatar_initials || '?'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.first_name} {user?.last_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {user?.role} · {user?.organization_name}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>First Name</label>
              <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Last Name</label>
              <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {saved && (
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--green)' }}>
              Profile updated successfully.
            </div>
          )}

          <button
            className="btn-primary"
            onClick={() => saveMutation.mutate({ first_name: firstName, last_name: lastName, email })}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* ADR info card */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            Architecture Notes
          </div>
          {[
            ['Data Model', 'Multi-tenant schema with Organization → Facility → EnergyRecord hierarchy. JSONField stores raw source data for full auditability.'],
            ['Validation Engine', 'Stateless Python class with separate validators per source type. Each rule returns a typed flag with severity and message.'],
            ['Quality Score', 'score = 100 − (errors/total × 60) − (warnings/total × 20). Errors carry 3× the weight of warnings.'],
            ['Audit Trail', 'Dedicated AuditLog model (not shadow tables) — transparent, queryable, and easy to explain.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
