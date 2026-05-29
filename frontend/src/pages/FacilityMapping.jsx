import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Plus, ChevronRight, Link2 } from 'lucide-react'
import api from '../lib/api'
import AppLayout from '../components/AppLayout'
import { PageHeader, Modal, Spinner, EmptyState } from '../components/ui'

export default function FacilityMapping() {
  const [showCreate, setShowCreate] = useState(false)
  const [showMapAlias, setShowMapAlias] = useState(null) // raw_code to map
  const [newFacility, setNewFacility] = useState({ name: '', code: '', facility_type: 'PLANT', city: '', country: 'India' })
  const [aliasTarget, setAliasTarget] = useState('')
  const queryClient = useQueryClient()

  const { data: facilities, isLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api.get('/facilities/').then(r => r.data.results || r.data),
  })

  const { data: unmapped } = useQuery({
    queryKey: ['unmapped-facilities'],
    queryFn: () => api.get('/facilities/unmapped/').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/facilities/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      setShowCreate(false)
      setNewFacility({ name: '', code: '', facility_type: 'PLANT', city: '', country: 'India' })
    },
  })

  const mapAliasMutation = useMutation({
    mutationFn: (data) => api.post('/facilities/map-alias/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      queryClient.invalidateQueries({ queryKey: ['unmapped-facilities'] })
      setShowMapAlias(null)
      setAliasTarget('')
    },
  })

  return (
    <AppLayout>
      <PageHeader
        title="Facility Mapping"
        subtitle="Map raw source codes to canonical facilities"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Facility
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Facilities list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Canonical Facilities
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          ) : !facilities?.length ? (
            <EmptyState icon={<MapPin size={20} />} title="No facilities" description="Create a facility to start mapping source codes" />
          ) : (
            facilities.map(fac => (
              <div key={fac.id} className="table-row" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: 'var(--accent-subtle)', border: '1px solid #2a2a45',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-hover)',
                  }}>
                    <MapPin size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{fac.name}</span>
                      <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 4 }}>{fac.code}</code>
                      <span style={{
                        fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)',
                        padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)',
                      }}>{fac.facility_type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {fac.city}{fac.city && fac.country ? ', ' : ''}{fac.country}
                      {' · '}{fac.record_count} records
                    </div>

                    {/* Aliases */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {fac.aliases?.map(alias => (
                        <span key={alias.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, color: 'var(--accent-hover)',
                          background: 'var(--accent-subtle)', padding: '3px 8px',
                          borderRadius: 6, border: '1px solid #2a2a45',
                        }}>
                          <Link2 size={10} />
                          {alias.raw_code}
                          {alias.source_type && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({alias.source_type})</span>}
                        </span>
                      ))}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '3px 0' }}>
                        {fac.aliases?.length === 0 && 'No aliases yet'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Unmapped codes */}
        <div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Unmapped Source Codes
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Raw codes from uploads with no facility match
              </div>
            </div>

            {!unmapped?.length ? (
              <div style={{ padding: '20px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                All source codes are mapped
              </div>
            ) : (
              unmapped.map(({ raw_code, source_type }) => (
                <div key={raw_code} className="table-row" style={{
                  padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div>
                    <code style={{ fontSize: 13, color: 'var(--yellow)' }}>{raw_code}</code>
                    {source_type && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{source_type}</div>
                    )}
                  </div>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => setShowMapAlias({ raw_code, source_type })}
                  >
                    Map
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Info card */}
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              How facility mapping works
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              When data is ingested, the parser looks up raw codes (like "PLT-001") against known aliases.
              Unmapped codes create warning flags. Map them here to resolve those flags.
              Future uploads with the same code will resolve automatically.
            </div>
          </div>
        </div>
      </div>

      {/* Create Facility Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Facility">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Facility Name', key: 'name', placeholder: 'e.g. Mumbai Plant' },
            { label: 'Code', key: 'code', placeholder: 'e.g. FAC-MUM-001' },
            { label: 'City', key: 'city', placeholder: 'Mumbai' },
            { label: 'Country', key: 'country', placeholder: 'India' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                className="input"
                placeholder={placeholder}
                value={newFacility[key]}
                onChange={e => setNewFacility(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Type</label>
            <select className="select" style={{ width: '100%' }} value={newFacility.facility_type}
              onChange={e => setNewFacility(f => ({ ...f, facility_type: e.target.value }))}>
              {[['PLANT', 'Manufacturing Plant'], ['OFFICE', 'Office'], ['WAREHOUSE', 'Warehouse'], ['DATA_CENTER', 'Data Center'], ['OTHER', 'Other']].map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {createMutation.isError && (
            <div style={{ color: 'var(--red)', fontSize: 13 }}>
              {JSON.stringify(createMutation.error?.response?.data)}
            </div>
          )}
          <button className="btn-primary" onClick={() => createMutation.mutate(newFacility)} disabled={createMutation.isPending || !newFacility.name || !newFacility.code}>
            {createMutation.isPending ? 'Creating...' : 'Create Facility'}
          </button>
        </div>
      </Modal>

      {/* Map Alias Modal */}
      <Modal open={!!showMapAlias} onClose={() => setShowMapAlias(null)} title={`Map "${showMapAlias?.raw_code}" to Facility`} width={420}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Select the canonical facility this raw code should map to.
        </p>
        <select className="select" style={{ width: '100%', marginBottom: 16 }}
          value={aliasTarget} onChange={e => setAliasTarget(e.target.value)}>
          <option value="">— Select Facility —</option>
          {facilities?.map(f => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
        </select>
        {mapAliasMutation.isError && (
          <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>Failed to map alias.</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-primary"
            disabled={!aliasTarget || mapAliasMutation.isPending}
            onClick={() => mapAliasMutation.mutate({ raw_code: showMapAlias?.raw_code, facility_id: aliasTarget, source_type: showMapAlias?.source_type || '' })}
          >
            {mapAliasMutation.isPending ? 'Mapping...' : 'Save Mapping'}
          </button>
          <button className="btn-secondary" onClick={() => setShowMapAlias(null)}>Cancel</button>
        </div>
      </Modal>
    </AppLayout>
  )
}
