import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import AppLayout from '../components/AppLayout'
import { PageHeader, QualityBar, QualityScore, SourceBadge, StatusBadge, Spinner, EmptyState } from '../components/ui'
import { format, parseISO } from 'date-fns'

function DropZone({ onFile, uploading }) {
  const [drag, setDrag] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const handleChange = (e) => {
    if (e.target.files[0]) onFile(e.target.files[0])
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '40px 24px',
        cursor: 'pointer',
        background: drag ? 'rgba(99,102,241,0.05)' : 'var(--bg-secondary)',
        transition: 'border-color 0.15s, background 0.15s',
        minHeight: 160,
      }}
    >
      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleChange} style={{ display: 'none' }} />
      {uploading ? (
        <Spinner size={28} />
      ) : (
        <>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: drag ? 'var(--accent-subtle)' : 'var(--bg-card)',
            border: `1px solid ${drag ? 'var(--accent)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, color: drag ? 'var(--accent-hover)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            <Upload size={20} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Drop your file here or click to browse
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Supports CSV and Excel (.xlsx) files up to 10 MB
          </div>
        </>
      )}
    </label>
  )
}

function QualityReport({ upload }) {
  if (!upload) return null
  const { valid_count, warning_count, error_count, total_records, quality_score } = upload

  return (
    <div className="card animate-fade-in" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Quality Report
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {upload.filename} · {total_records} records processed
          </div>
        </div>
        <QualityScore score={quality_score} />
      </div>

      <QualityBar score={quality_score} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
        {[
          { label: 'Valid', count: valid_count, color: 'var(--green)', icon: <CheckCircle size={14} /> },
          { label: 'Warnings', count: warning_count, color: 'var(--yellow)', icon: <AlertTriangle size={14} /> },
          { label: 'Errors', count: error_count, color: 'var(--red)', icon: <XCircle size={14} /> },
        ].map(({ label, count, color, icon }) => (
          <div key={label} style={{
            background: 'var(--bg-secondary)', borderRadius: 8,
            padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
              {icon}
              <span style={{ fontSize: 20, fontWeight: 700 }}>{count}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {upload.status === 'REVIEW' && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--accent-subtle)', borderRadius: 8,
          border: '1px solid #2a2a45',
          fontSize: 13, color: 'var(--accent-hover)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <ChevronRight size={14} />
          Records are now in the Review Queue. Open Review Queue to approve or flag issues.
        </div>
      )}
    </div>
  )
}

export default function UploadCenter() {
  const [file, setFile] = useState(null)
  const [sourceType, setSourceType] = useState('SAP_FUEL')
  const [lastUpload, setLastUpload] = useState(null)
  const queryClient = useQueryClient()

  const { data: uploads, isLoading } = useQuery({
    queryKey: ['uploads'],
    queryFn: () => api.get('/uploads/list/').then(r => r.data.results || r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) => api.post('/uploads/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onSuccess: (res) => {
      setLastUpload(res.data)
      setFile(null)
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const handleFile = (f) => setFile(f)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('source_type', sourceType)
    uploadMutation.mutate(fd)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Upload Center"
        subtitle="Ingest ESG data from SAP, utility providers, and travel systems"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Upload form */}
        <div>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              New Upload
            </h3>

            {/* Source type selector */}
            <div style={{ marginBottom: 20 }}>
              <label className="label" style={{ display: 'block', marginBottom: 10 }}>
                Data Source
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { value: 'SAP_FUEL', label: 'SAP Fuel', desc: 'Fuel & procurement exports', color: '#fb923c' },
                  { value: 'UTILITY_ELEC', label: 'Electricity', desc: 'Utility billing CSVs', color: '#60a5fa' },
                  { value: 'CORP_TRAVEL', label: 'Travel', desc: 'Flight, hotel, ground', color: '#4ade80' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSourceType(opt.value)}
                    style={{
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${sourceType === opt.value ? opt.color + '60' : 'var(--border)'}`,
                      background: sourceType === opt.value ? opt.color + '10' : 'var(--bg-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: sourceType === opt.value ? opt.color : 'var(--text-primary)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <DropZone onFile={handleFile} uploading={uploadMutation.isPending} />

              {file && (
                <div className="animate-fade-in" style={{
                  marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}>
                  <FileText size={16} color="var(--accent)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}
                  >×</button>
                </div>
              )}

              {uploadMutation.isError && (
                <div className="animate-fade-in" style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'var(--red-subtle)', border: '1px solid #3a1515',
                  borderRadius: 8, fontSize: 13, color: '#f87171',
                }}>
                  {uploadMutation.error?.response?.data?.error || 
                   uploadMutation.error?.response?.data?.file?.[0] || 
                   'Upload failed. Please check your file format.'}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={!file || uploadMutation.isPending}
                style={{ marginTop: 16, width: '100%', justifyContent: 'center', padding: '11px 16px' }}
              >
                {uploadMutation.isPending ? 'Processing...' : 'Upload & Validate'}
              </button>
            </form>

            {lastUpload && <QualityReport upload={lastUpload} />}
          </div>

          {/* Source format hints */}
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              Expected Columns for{' '}
              <SourceBadge sourceType={sourceType} />
            </div>
            {sourceType === 'SAP_FUEL' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Plant / Plant Code', 'Posting Date / Date', 'Quantity / Volume', 'Unit / UoM', 'Material / Fuel Type'].map(c => (
                  <code key={c} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 4 }}>{c}</code>
                ))}
              </div>
            )}
            {sourceType === 'UTILITY_ELEC' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Meter ID / Account Number', 'Billing Period / Month', 'Consumption / kWh', 'Unit', 'Facility / Site'].map(c => (
                  <code key={c} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 4 }}>{c}</code>
                ))}
              </div>
            )}
            {sourceType === 'CORP_TRAVEL' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Traveler / Employee', 'Travel Date', 'Origin (IATA)', 'Destination (IATA)', 'Distance (km)', 'Category / Mode'].map(c => (
                  <code key={c} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 4 }}>{c}</code>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload history */}
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Upload History
              </div>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <Spinner />
              </div>
            ) : !uploads?.length ? (
              <EmptyState
                icon={<Upload size={20} />}
                title="No uploads yet"
                description="Upload your first ESG data file to get started"
              />
            ) : (
              <div>
                {uploads.map(upload => (
                  <div key={upload.id} className="table-row" style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <FileText size={14} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>
                          {upload.filename}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <SourceBadge sourceType={upload.source_type} />
                          <StatusBadge status={upload.status} />
                        </div>
                      </div>
                    </div>
                    <div style={{ paddingLeft: 24 }}>
                      <QualityBar score={upload.quality_score} />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                        {upload.total_records} records ·{' '}
                        {upload.created_at ? format(parseISO(upload.created_at), 'MMM d, yyyy') : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
