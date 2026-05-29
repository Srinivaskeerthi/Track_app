import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import api from '../lib/api'
import AppLayout from '../components/AppLayout'
import { PageHeader, StatusBadge, ScopeBadge, SourceBadge, FlagItem, Spinner } from '../components/ui'

function AuditTimeline({ recordId }) {
  const { data: logs } = useQuery({
    queryKey: ['audit', recordId],
    queryFn: () => api.get('/audit-logs/', { params: { entity_id: recordId, entity_type: 'EnergyRecord' } }).then(r => r.data.results || r.data),
  })

  if (!logs?.length) return (
    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>
      No audit history for this record.
    </div>
  )

  const actionColors = {
    APPROVED: 'var(--green)', REJECTED: 'var(--red)',
    LOCKED: '#a78bfa', NOTE_ADDED: 'var(--accent)',
    CREATED: 'var(--text-muted)', UPDATED: 'var(--yellow)',
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 13, top: 0, bottom: 0,
        width: 1, background: 'var(--border)',
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {logs.map((log, i) => (
          <div key={log.id} style={{ display: 'flex', gap: 14, paddingBottom: 20, position: 'relative' }}>
            <div style={{
              width: 27, height: 27, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-secondary)', border: `2px solid ${actionColors[log.action] || 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white', zIndex: 1,
              backgroundImage: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            }}>
              {log.user_initials || '?'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {log.user_name}
                </span>
                <span style={{ fontSize: 13, color: actionColors[log.action] || 'var(--text-secondary)' }}>
                  {log.action_display?.toLowerCase()}
                </span>
              </div>
              {log.reason && (
                <div style={{
                  fontSize: 12, color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)', borderRadius: 6,
                  padding: '6px 10px', marginBottom: 4,
                  border: '1px solid var(--border)',
                }}>
                  "{log.reason}"
                </div>
              )}
              {log.old_value && log.new_value && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <code style={{ color: 'var(--red)', background: 'var(--red-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                    {JSON.stringify(log.old_value)}
                  </code>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <code style={{ color: 'var(--green)', background: 'var(--green-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                    {JSON.stringify(log.new_value)}
                  </code>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {log.timestamp ? format(parseISO(log.timestamp), 'MMM d, yyyy · h:mm a') : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RecordDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: record, isLoading } = useQuery({
    queryKey: ['record', id],
    queryFn: () => api.get(`/records/${id}/`).then(r => r.data),
  })

  if (isLoading) return <AppLayout><div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner size={32} /></div></AppLayout>
  if (!record) return <AppLayout><div style={{ color: 'var(--text-muted)', padding: 32 }}>Record not found.</div></AppLayout>

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <button className="btn-secondary btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> Back to Queue
        </button>
      </div>

      <PageHeader
        title={`Record Detail`}
        subtitle={`${record.upload_filename} · Row ${record.source_row}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SourceBadge sourceType={record.source_type} />
            <ScopeBadge scope={record.scope} />
            <StatusBadge status={record.status} />
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: flags + data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Validation Flags */}
          {record.flags?.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div className="label" style={{ marginBottom: 14 }}>
                Validation Issues ({record.flags.length})
              </div>
              {record.flags.map(f => <FlagItem key={f.id} flag={f} />)}
            </div>
          )}

          {/* Normalized Data */}
          <div className="card" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 14 }}>Normalized Data</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Date', value: record.record_date ? format(parseISO(record.record_date), 'dd MMMM yyyy') : null },
                { label: 'Quantity', value: record.normalized_quantity ? `${parseFloat(record.normalized_quantity).toLocaleString()} ${record.normalized_unit}` : null },
                { label: 'Category', value: record.category },
                { label: 'Facility', value: record.facility?.name },
                record.origin && { label: 'Origin', value: record.origin },
                record.destination && { label: 'Destination', value: record.destination },
                record.travel_mode && { label: 'Travel Mode', value: record.travel_mode },
              ].filter(Boolean).map(({ label, value }) => value ? (
                <div key={label} style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                  <div style={{ width: 120, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Raw Data */}
          <div className="card" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 14 }}>Raw Source Data</div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', padding: '12px 14px', overflow: 'auto', maxHeight: 300 }}>
              {record.raw_data && Object.entries(record.raw_data).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  <code style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 140, flexShrink: 0 }}>{k}</code>
                  <code style={{ fontSize: 12, color: v ? 'var(--text-secondary)' : 'var(--red)' }}>
                    {v || <em>empty</em>}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: review info + audit trail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Review info */}
          {(record.reviewed_by || record.analyst_notes) && (
            <div className="card" style={{ padding: 20 }}>
              <div className="label" style={{ marginBottom: 14 }}>Review Information</div>
              {record.reviewed_by && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Reviewed by</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {record.reviewed_by.first_name} {record.reviewed_by.last_name} ({record.reviewed_by.role})
                  </div>
                  {record.reviewed_at && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {format(parseISO(record.reviewed_at), 'MMM d, yyyy · h:mm a')}
                    </div>
                  )}
                </div>
              )}
              {record.analyst_notes && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Notes</div>
                  <div style={{
                    background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                    padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                  }}>
                    {record.analyst_notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit Trail */}
          <div className="card" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 16 }}>Audit Trail</div>
            <AuditTimeline recordId={id} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
