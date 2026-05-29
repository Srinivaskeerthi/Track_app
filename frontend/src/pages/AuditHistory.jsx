import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import api from '../lib/api'
import AppLayout from '../components/AppLayout'
import { PageHeader, Spinner } from '../components/ui'

const actionColors = {
  APPROVED: 'var(--green)', REJECTED: 'var(--red)',
  LOCKED: '#a78bfa', NOTE_ADDED: 'var(--accent)',
  UPLOAD: '#60a5fa', FACILITY_MAPPED: 'var(--yellow)',
  CREATED: 'var(--text-muted)', UPDATED: 'var(--text-secondary)',
}

export default function AuditHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/audit-logs/').then(r => r.data.results || r.data),
  })

  const logs = data || []

  return (
    <AppLayout>
      <PageHeader
        title="Audit History"
        subtitle="Complete immutable trail of all analyst actions"
      />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {logs.length} audit events
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Immutable — entries cannot be modified or deleted
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>
        ) : (
          <div style={{ padding: '20px 24px', position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 47, top: 20, bottom: 20,
              width: 1, background: 'var(--border)',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {logs.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: 16, paddingBottom: 24, position: 'relative' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    backgroundImage: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: `2px solid ${actionColors[log.action] || 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'white', zIndex: 1,
                  }}>
                    {log.user_initials || '?'}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.user_name}
                      </span>
                      <span style={{
                        fontSize: 13,
                        color: actionColors[log.action] || 'var(--text-secondary)',
                        fontWeight: 500,
                      }}>
                        {log.action_display}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {log.entity_type}
                      </span>
                    </div>

                    {log.reason && (
                      <div style={{
                        fontSize: 13, color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '6px 10px', marginBottom: 6,
                        fontStyle: 'italic',
                      }}>
                        "{log.reason}"
                      </div>
                    )}

                    {(log.old_value || log.new_value) && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap' }}>
                        {log.old_value && (
                          <code style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-subtle)', padding: '3px 8px', borderRadius: 5, border: '1px solid #3a1515' }}>
                            − {JSON.stringify(log.old_value)}
                          </code>
                        )}
                        {log.new_value && (
                          <code style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-subtle)', padding: '3px 8px', borderRadius: 5, border: '1px solid #1a3825' }}>
                            + {JSON.stringify(log.new_value)}
                          </code>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {log.timestamp ? format(parseISO(log.timestamp), 'EEEE, MMMM d, yyyy · h:mm a') : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
