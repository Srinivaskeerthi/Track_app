import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { Upload, ClipboardList, CheckCircle, AlertTriangle, Zap, TrendingUp } from 'lucide-react'
import api from '../lib/api'
import AppLayout from '../components/AppLayout'
import { PageHeader, StatCard, QualityBar, SourceBadge, StatusBadge, Spinner } from '../components/ui'
import { format, parseISO } from 'date-fns'

function useStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats/').then(r => r.data),
    refetchInterval: 30000,
  })
}

function useActivity() {
  return useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => api.get('/dashboard/activity/').then(r => r.data),
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="card" style={{ padding: '10px 14px', fontSize: 13 }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    )
  }
  return null
}

const actionColors = {
  APPROVED: 'var(--green)',
  REJECTED: 'var(--red)',
  UPLOAD: 'var(--accent)',
  FACILITY_MAPPED: 'var(--yellow)',
  LOCKED: '#a78bfa',
  NOTE_ADDED: 'var(--text-muted)',
}

export default function Dashboard() {
  const { data: stats, isLoading } = useStats()
  const { data: activity } = useActivity()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <Spinner size={32} />
        </div>
      </AppLayout>
    )
  }

  const sourceChartData = stats ? Object.entries(stats.uploads_by_source).map(([k, v]) => ({
    name: k === 'SAP_FUEL' ? 'SAP Fuel' : k === 'UTILITY_ELEC' ? 'Electricity' : 'Travel',
    uploads: v,
  })) : []

  const qualityChartData = (stats?.recent_quality_scores || []).slice().reverse().map((r, i) => ({
    name: r.filename?.split('.')[0]?.slice(-12) || `Upload ${i + 1}`,
    score: r.quality_score,
    type: r.source_type,
  }))

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        subtitle="Data ingestion & quality overview"
        actions={
          <button className="btn-primary" onClick={() => navigate('/upload')}>
            <Upload size={14} />
            New Upload
          </button>
        }
      />

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Total Uploads"
          value={stats?.total_uploads || 0}
          sub={`${stats?.total_records || 0} records total`}
          icon={<Upload size={16} />}
        />
        <StatCard
          label="Pending Review"
          value={stats?.pending_review || 0}
          sub="Records awaiting analyst action"
          icon={<ClipboardList size={16} />}
        />
        <StatCard
          label="Approved"
          value={stats?.approved_records || 0}
          sub="Records approved & ready"
          icon={<CheckCircle size={16} />}
        />
        <StatCard
          label="Anomalies"
          value={stats?.anomaly_count || 0}
          sub="Spikes or duplicates detected"
          icon={<Zap size={16} />}
        />
      </div>

      {/* Quality score + charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Quality score history */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Quality Score Trend
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Last {qualityChartData.length} uploads
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} color="var(--accent)" />
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {stats?.avg_quality_score || 0}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>avg</span>
            </div>
          </div>
          {qualityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={qualityChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No upload data yet
            </div>
          )}
        </div>

        {/* Uploads by source */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Uploads by Source
          </div>
          {sourceChartData.some(d => d.uploads > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sourceChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="uploads" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Uploads" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No uploads yet
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: avg quality + activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Error breakdown */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Record Health
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Approved', value: stats?.approved_records || 0, color: 'var(--green)' },
              { label: 'Pending Review', value: stats?.pending_review || 0, color: 'var(--yellow)' },
              { label: 'Error', value: stats?.error_records || 0, color: 'var(--red)' },
            ].map(({ label, value, color }) => {
              const total = (stats?.total_records || 1)
              const pct = Math.round((value / total) * 100)
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Avg Quality Score
            </div>
            <QualityBar score={stats?.avg_quality_score || 0} />
          </div>
        </div>

        {/* Activity timeline */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Recent Activity
          </div>
          {activity?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.slice(0, 8).map((log, i) => (
                <div key={log.id} style={{
                  display: 'flex', gap: 14, paddingBottom: 14,
                  borderBottom: i < Math.min(activity.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none',
                  marginBottom: i < Math.min(activity.length, 8) - 1 ? 14 : 0,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'white',
                  }}>
                    {log.user_initials || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 500 }}>{log.user_name}</span>
                      {' '}
                      <span style={{ color: actionColors[log.action] || 'var(--text-secondary)' }}>
                        {log.action_display?.toLowerCase()}
                      </span>
                      {log.new_value?.filename && (
                        <span style={{ color: 'var(--text-secondary)' }}> — {log.new_value.filename}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {log.timestamp ? format(parseISO(log.timestamp), 'MMM d, h:mm a') : ''}
                      {log.reason && <span style={{ color: 'var(--accent)' }}> · {log.reason}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              No activity yet
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
