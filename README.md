# Track_app

## Quick Start (Local)

### Backend (Django)
```bash
# From project root
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:5173

## Architecture


    ├── EnergyRecord (normalized + raw_data JSONField)
    │   └── ValidationFlag (per-field issues with severity)
    └── AuditLog (immutable audit trail)
```

### Source Types
| Source | Scope | Normalized Unit |
|--------|-------|-----------------|
| SAP Fuel & Procurement | 1 | L, kg, m³ |
| Utility Electricity | 2 | kWh |
| Corporate Travel | 3 | km |

### Quality Score Formula
```python
score = 100
score -= (error_count / total_records) * 60   # errors are heavy
score -= (warning_count / total_records) * 20  # warnings are light
score = max(0, round(score))
```

### Validation Rules
**SAP Fuel**: Missing quantity, missing unit, invalid unit, invalid date, unknown facility, negative value, exact duplicate  
**Electricity**: Missing consumption, negative value, invalid unit, missing meter ID, anomaly spike (>3σ)  
**Travel**: Missing origin/destination, unknown IATA code, missing distance, invalid date, duplicate booking


## Pages Built
- **Login** — JWT auth with demo credential hints
- **Dashboard** — Quality score trend, uploads by source, record health, activity timeline
- **Upload Center** — Drag-drop with source type selection, quality report, upload history
- **Review Queue** — Hero screen: filterable records table, inline side panel with raw vs normalized comparison, approve/reject/lock/note actions
- **Record Detail** — Full record view with audit trail timeline
- **Audit History** — Global immutable log of all analyst actions
- **Facility Mapping** — Map raw codes to canonical facilities, unmapped code resolution
- **Settings** — Profile + architecture notes for interview reference
