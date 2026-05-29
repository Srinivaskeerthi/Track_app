// Shared UI primitives

// Status badge for records
export function StatusBadge({ status }) {
  const map = {
    VALID: { cls: 'badge badge-valid', label: 'Valid' },
    WARNING: { cls: 'badge badge-warning', label: 'Warning' },
    ERROR: { cls: 'badge badge-error', label: 'Error' },
    APPROVED: { cls: 'badge badge-approved', label: 'Approved' },
    REJECTED: { cls: 'badge badge-rejected', label: 'Rejected' },
    LOCKED: { cls: 'badge badge-locked', label: 'Locked' },
    PENDING: { cls: 'badge badge-pending', label: 'Pending' },
    REVIEW: { cls: 'badge badge-warning', label: 'Under Review' },
  }
  const { cls, label } = map[status] || { cls: 'badge badge-pending', label: status }
  return <span className={cls}>{label}</span>
}

// Scope badge
export function ScopeBadge({ scope }) {
  const map = {
    1: { cls: 'badge badge-scope1', label: 'Scope 1' },
    2: { cls: 'badge badge-scope2', label: 'Scope 2' },
    3: { cls: 'badge badge-scope3', label: 'Scope 3' },
  }
  const { cls, label } = map[scope] || { cls: 'badge badge-pending', label: `Scope ${scope}` }
  return <span className={cls}>{label}</span>
}

// Source type badge
export function SourceBadge({ sourceType }) {
  const map = {
    SAP_FUEL: { color: '#fb923c', bg: '#1f1506', border: '#3a2510', label: 'SAP Fuel' },
    UTILITY_ELEC: { color: '#60a5fa', bg: '#060a1f', border: '#0f1a35', label: 'Electricity' },
    CORP_TRAVEL: { color: '#4ade80', bg: '#0d1a0d', border: '#1a3a1a', label: 'Travel' },
  }
  const s = map[sourceType] || { color: '#8b8ba8', bg: '#16161f', border: '#252535', label: sourceType }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      fontSize: 12, fontWeight: 500,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

// Severity badge for flags
export function SeverityBadge({ severity }) {
  const map = {
    ERROR: 'badge badge-error',
    WARNING: 'badge badge-warning',
    INFO: 'badge badge-pending',
  }
  return <span className={map[severity] || 'badge badge-pending'}>{severity}</span>
}

// Quality score display
export function QualityScore({ score }) {
  const cls = score >= 80 ? 'quality-score-high' : score >= 60 ? 'quality-score-medium' : 'quality-score-low'
  return (
    <span className={cls} style={{ fontWeight: 700, fontSize: 16 }}>
      {score}
      <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2, color: 'var(--text-muted)' }}>/100</span>
    </span>
  )
}

// Quality score bar
export function QualityBar({ score }) {
  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--yellow)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        flex: 1, height: 6, borderRadius: 3,
        background: 'var(--border)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: color, borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 28, textAlign: 'right' }}>
        {score}
      </span>
    </div>
  )
}

// Loading spinner
export function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '2px solid var(--border)',
      borderTop: '2px solid var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// Empty state
export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
    }}>
      {icon && (
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, color: 'var(--text-muted)',
        }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320 }}>
        {description}
      </div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

// Page header
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: 24, gap: 16,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}

// Stat card
export function StatCard({ label, value, sub, icon, trend }) {
  return (
    <div className="card" style={{ padding: '20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </div>
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// Flag item
export function FlagItem({ flag }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ paddingTop: 2 }}>
        <span className={flag.severity === 'ERROR' ? 'flag-dot-error' : 'flag-dot-warning'} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <SeverityBadge severity={flag.severity} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {flag.flag_type.replace(/_/g, ' ')}
          </span>
          {flag.field_name && (
            <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 4 }}>
              {flag.field_name}
            </code>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {flag.message}
        </p>
      </div>
    </div>
  )
}

// Modal
export function Modal({ open, onClose, title, children, width = 540 }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card animate-fade-in" style={{ width, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 20, lineHeight: 1,
            padding: '0 4px',
          }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}
