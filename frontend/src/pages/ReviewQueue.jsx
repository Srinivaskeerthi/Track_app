import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle, XCircle, Lock, MessageSquare, Filter,
  ChevronRight, AlertTriangle, Zap, Search, SlidersHorizontal
} from 'lucide-react'
import api from '../lib/api'
import AppLayout from '../components/AppLayout'
import {
  PageHeader, StatusBadge, ScopeBadge, SourceBadge,
  FlagItem, Modal, Spinner, EmptyState
} from '../components/ui'
import { format, parseISO } from 'date-fns'

function useRecords(filters) {
  return useQuery({
    queryKey: ['records', filters],
    queryFn: () => api.get('/records/', { params: filters }).then(r => r.data),
    keepPreviousData: true,
  })
}

function RecordRow({ record, onSelect, selected }) {
  const errorFlags = record.flags?.filter(f => f.severity === 'ERROR') || []
  const warnFlags = record.flags?.filter(f => f.severity === 'WARNING') || []

  return (
    <div
      className="table-row"
      onClick={() => onSelect(record)}
      style={{
        padding: '10px 16px',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: 'minmax(160px,2fr) minmax(100px,1fr) minmax(90px,1fr) minmax(110px,1.2fr) minmax(90px,1fr) minmax(90px,1fr) 44px',
        gap: 8,
        alignItems: 'center',
        background: selected ? 'rgba(99,102,241,0.06)' : undefined,
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        minWidth: 640,
      }}
    >
      {/* Source + file */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <SourceBadge sourceType={record.source_type} />
          <ScopeBadge scope={record.scope} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.upload_filename} · row {record.source_row}
        </div>
      </div>

      {/* Facility */}
      <div style={{ fontSize: 13, color: record.facility_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {record.facility_name || (record.origin && record.destination
          ? `${record.origin} → ${record.destination}`
          : 'Unmapped')}
      </div>

      {/* Date */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {record.record_date ? format(parseISO(record.record_date), 'dd MMM yyyy') : '—'}
      </div>

      {/* Quantity */}
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {record.normalized_quantity
          ? `${parseFloat(record.normalized_quantity).toLocaleString()} ${record.normalized_unit}`
          : '—'}
      </div>

      {/* Flags */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {errorFlags.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 600,
            color: 'var(--red)', background: 'var(--red-subtle)',
            padding: '2px 6px', borderRadius: 10,
            border: '1px solid #3a1515',
          }}>
            <span className="flag-dot-error" />
            {errorFlags.length} error{errorFlags.length > 1 ? 's' : ''}
          </span>
        )}
        {warnFlags.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 600,
            color: 'var(--yellow)', background: 'var(--yellow-subtle)',
            padding: '2px 6px', borderRadius: 10,
            border: '1px solid #3a2a10',
          }}>
            <span className="flag-dot-warning" />
            {warnFlags.length} warn
          </span>
        )}
        {record.flags?.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clean</span>
        )}
      </div>

      {/* Status */}
      <div><StatusBadge status={record.status} /></div>

      {/* Action hint */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ChevronRight size={14} color="var(--text-muted)" />
      </div>
    </div>
  )
}

function RecordPanel({ record, onClose, onActionSuccess }) {
  const [noteText, setNoteText] = useState(record.analyst_notes || '')
  const [showNoteBox, setShowNoteBox] = useState(false)
  const [actionModal, setActionModal] = useState(null) // 'approve' | 'reject' | 'lock'
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['records'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    // Close panel so user sees fresh status in table row
    onActionSuccess()
  }

  const approveMutation = useMutation({
    mutationFn: (data) => api.patch(`/records/${record.id}/approve/`, data),
    onSuccess: () => { invalidate(); setActionModal(null) },
  })
  const rejectMutation = useMutation({
    mutationFn: (data) => api.patch(`/records/${record.id}/reject/`, data),
    onSuccess: () => { invalidate(); setActionModal(null) },
  })
  const lockMutation = useMutation({
    mutationFn: (data) => api.patch(`/records/${record.id}/lock/`, data),
    onSuccess: () => { invalidate(); setActionModal(null) },
  })
  const noteMutation = useMutation({
    mutationFn: (data) => api.post(`/records/${record.id}/notes/`, data),
    onSuccess: () => { invalidate(); setShowNoteBox(false) },
  })

  const isLocked = record.status === 'LOCKED'
  const isApproved = record.status === 'APPROVED'

  // Show raw vs normalized comparison
  const rawKeys = record.raw_data ? Object.keys(record.raw_data) : []

  return (
    <div style={{
      width: 460, minWidth: 460,
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <SourceBadge sourceType={record.source_type} />
            <ScopeBadge scope={record.scope} />
            <StatusBadge status={record.status} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {record.upload_filename} · Row {record.source_row}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => navigate(`/records/${record.id}`)}
            className="btn-secondary btn-sm"
          >
            Full View
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 20, padding: '0 4px',
          }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 20px' }}>

        {/* Validation Flags */}
        {record.flags?.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
              Validation Issues ({record.flags.length})
            </div>
            {record.flags.map(flag => (
              <FlagItem key={flag.id} flag={flag} />
            ))}
          </div>
        )}

        {/* Raw vs Normalized Comparison */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
            Normalized Data
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Date', value: record.record_date ? format(parseISO(record.record_date), 'dd MMM yyyy') : null },
              { label: 'Quantity', value: record.normalized_quantity ? `${parseFloat(record.normalized_quantity).toLocaleString()} ${record.normalized_unit}` : null },
              { label: 'Category', value: record.category },
              { label: 'Facility', value: record.facility_name },
              record.origin && { label: 'Route', value: `${record.origin} → ${record.destination}` },
              record.travel_mode && { label: 'Mode', value: record.travel_mode },
              record.reviewed_by_name && { label: 'Reviewed by', value: record.reviewed_by_name },
            ].filter(Boolean).map(({ label, value }) => value ? (
              <div key={label} style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 90, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 1 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Raw source data */}
        {record.raw_data && rawKeys.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
              Raw Source Data
            </div>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 8,
              border: '1px solid var(--border)', padding: '10px 12px',
              maxHeight: 200, overflow: 'auto',
            }}>
              {rawKeys.map(k => (
                <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                  <code style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 120, flexShrink: 0 }}>{k}</code>
                  <code style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {record.raw_data[k] || <em style={{ color: 'var(--red)', opacity: 0.7 }}>empty</em>}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analyst notes */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
            Analyst Notes
          </div>
          {record.analyst_notes ? (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 8,
              border: '1px solid var(--border)', padding: '10px 12px',
              fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
              marginBottom: 10,
            }}>
              {record.analyst_notes}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>No notes yet.</div>
          )}

          {!isLocked && (
            showNoteBox ? (
              <div className="animate-fade-in">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Add an analyst note..."
                  style={{ resize: 'none', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => noteMutation.mutate({ note: noteText })}
                    disabled={!noteText.trim() || noteMutation.isPending}
                  >
                    {noteMutation.isPending ? 'Saving...' : 'Save Note'}
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setShowNoteBox(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary btn-sm" onClick={() => setShowNoteBox(true)}>
                <MessageSquare size={13} />
                {record.analyst_notes ? 'Edit Note' : 'Add Note'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!isLocked && (
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8,
        }}>
          {!isApproved ? (
            <>
              <button className="btn-success" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActionModal('approve')}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn-danger" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActionModal('reject')}>
                <XCircle size={14} /> Reject
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActionModal('reject')}>
                <XCircle size={14} /> Undo Approval
              </button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActionModal('lock')}>
                <Lock size={14} /> Lock Record
              </button>
            </>
          )}
        </div>
      )}

      {isLocked && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: '#a78bfa',
        }}>
          <Lock size={14} />
          Record is locked. No further modifications allowed.
        </div>
      )}

      {/* Confirm modal */}
      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={actionModal === 'approve' ? 'Approve Record' : actionModal === 'reject' ? 'Reject Record' : 'Lock Record'}
        width={420}
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          {actionModal === 'approve' && 'Approving this record marks it as validated by an analyst. You can still reject it until it is locked.'}
          {actionModal === 'reject' && 'Rejecting this record flags it as invalid. Add an optional reason for the audit trail.'}
          {actionModal === 'lock' && 'Locking a record makes it immutable. This action cannot be undone. Only approved records can be locked.'}
        </p>
        <div style={{ marginBottom: 16 }}>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>
            Reason (optional)
          </label>
          <textarea
            className="input"
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={actionModal === 'approve' ? 'e.g. Verified against PO-2024-0892' : 'e.g. Duplicate record from June re-export'}
            style={{ resize: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {actionModal === 'approve' && (
            <button
              className="btn-success"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => approveMutation.mutate({ reason, notes: noteText })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Confirm Approve'}
            </button>
          )}
          {actionModal === 'reject' && (
            <button
              className="btn-danger"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => rejectMutation.mutate({ reason, notes: noteText })}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          )}
          {actionModal === 'lock' && (
            <button
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => lockMutation.mutate({ reason })}
              disabled={lockMutation.isPending}
            >
              {lockMutation.isPending ? 'Locking...' : 'Confirm Lock'}
            </button>
          )}
          <button className="btn-secondary" onClick={() => setActionModal(null)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}

export default function ReviewQueue() {
  const [filters, setFilters] = useState({ ordering: '-created_at' })
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useRecords({ ...filters, search })
  const records = data?.results || data || []
  const total = data?.count || records.length

  const setFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val || undefined }))
    setSelected(null)
  }

  const statusCounts = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1; return acc
  }, {})

  const tableHeader = ['Source / File', 'Facility', 'Date', 'Quantity', 'Flags', 'Status', '']

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title="Review Queue"
        subtitle={`${total} records · analyst review and approval workflow`}
      />

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16,
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            placeholder="Search category, facility, file..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Status filter */}
        <select className="select" style={{ width: 160 }} value={filters.status || ''} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          {['VALID', 'WARNING', 'ERROR', 'APPROVED', 'REJECTED', 'LOCKED'].map(s => (
            <option key={s} value={s}>{s} {statusCounts[s] ? `(${statusCounts[s]})` : ''}</option>
          ))}
        </select>

        {/* Source filter */}
        <select className="select" style={{ width: 160 }} value={filters.source_type || ''} onChange={e => setFilter('source_type', e.target.value)}>
          <option value="">All Sources</option>
          <option value="SAP_FUEL">SAP Fuel</option>
          <option value="UTILITY_ELEC">Electricity</option>
          <option value="CORP_TRAVEL">Travel</option>
        </select>

        {/* Scope filter */}
        <select className="select" style={{ width: 130 }} value={filters.scope || ''} onChange={e => setFilter('scope', e.target.value)}>
          <option value="">All Scopes</option>
          <option value="1">Scope 1</option>
          <option value="2">Scope 2</option>
          <option value="3">Scope 3</option>
        </select>

        {/* Quick filters */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: 'Errors', status: 'ERROR', color: 'var(--red)' },
            { label: 'Warnings', status: 'WARNING', color: 'var(--yellow)' },
            { label: 'Pending', status: 'VALID', color: 'var(--text-muted)' },
          ].map(({ label, status, color }) => (
            <button
              key={status}
              className="btn-secondary btn-sm"
              onClick={() => setFilter('status', filters.status === status ? '' : status)}
              style={{
                borderColor: filters.status === status ? color : undefined,
                color: filters.status === status ? color : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: table + side panel */}
      <div style={{ display: 'flex', minHeight: 0, flex: 1, gap: 0, overflow: 'hidden' }}>
        {/* Table */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: selected ? '12px 0 0 12px' : 12 }}>
            {/* Scrollable table wrapper */}
            <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(160px,2fr) minmax(100px,1fr) minmax(90px,1fr) minmax(110px,1.2fr) minmax(90px,1fr) minmax(90px,1fr) 44px',
                gap: 8, padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                position: 'sticky', top: 0,
                background: 'var(--bg-card)', zIndex: 1,
                minWidth: 640,
              }}>
                {tableHeader.map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div style={{ minWidth: 640 }}>
                {isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                    <Spinner size={28} />
                  </div>
                ) : records.length === 0 ? (
                  <EmptyState
                    icon={<Filter size={20} />}
                    title="No records match"
                    description="Try adjusting your filters or upload new data"
                  />
                ) : (
                  records.map(r => (
                    <RecordRow
                      key={r.id}
                      record={r}
                      selected={selected?.id === r.id}
                      onSelect={setSelected}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Pagination info */}
            {data?.count > 25 && (
              <div style={{
                padding: '10px 16px', borderTop: '1px solid var(--border)',
                fontSize: 12, color: 'var(--text-muted)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>Showing {records.length} of {data.count} records</span>
                <span>Use filters to narrow results</span>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="animate-slide-in" style={{ overflow: 'auto', flexShrink: 0 }}>
            <RecordPanel
              record={selected}
              onClose={() => setSelected(null)}
              onActionSuccess={() => setSelected(null)}
            />
          </div>
        )}
      </div>
      </div>
    </AppLayout>
  )
}
