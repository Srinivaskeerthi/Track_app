# Breathe ESG — Data Ingestion & Analyst Review Platform

A production-quality ESG data platform built for the Breathe ESG internship assignment.

## Credentials (Demo)
| Username | Password | Role |
|----------|----------|------|
| admin | demo1234 | Admin (full access) |
| analyst | demo1234 | Analyst (review/approve) |

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

### Data Model
```
Organization (multi-tenant root)
├── User (with role: ADMIN | ANALYST | VIEWER)
├── Facility + FacilityAlias (facility mapping)
└── DataUpload (per-file tracking)
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

## Key Architecture Decisions

**Why Django over FastAPI** — Django ORM gives clean model definitions, easy to explain in interviews. DRF handles auth, permissions, and filtering out of the box.

**Why SQLite for dev, PostgreSQL for prod** — Single DATABASE_URL env var switches automatically via dj-database-url. No config duplication.

**Why React Query over Redux** — Our state is server-centric. React Query auto-invalidates the Review Queue when records are approved/rejected — exactly what we need.

**Why NOT to build carbon calculations** — The assignment says focus is data quality and auditability, not carbon math. Building half-baked emission factors would distract from the actual evaluation criteria.

**Why a dedicated AuditLog model** — More transparent than shadow tables. Every field has an obvious purpose. Easy to show and explain during an interview.

## Deployment

### Backend → Render
1. Create new Web Service from repo
2. Set environment variables:
   ```
   DATABASE_URL=<your-render-postgresql-url>
   SECRET_KEY=<generate-with-secrets.token_hex(32)>
   DEBUG=False
   ALLOWED_HOSTS=<your-render-domain>.onrender.com
   CORS_ALLOWED_ORIGINS=https://<your-vercel-domain>.vercel.app
   ```
3. Build command: `pip install -r requirements.txt && python manage.py migrate && python manage.py seed_demo`
4. Start command: `gunicorn backend.wsgi --log-file -`

### Frontend → Vercel
1. Set Root Directory to `frontend`
2. Add environment variable: `VITE_API_URL=https://<your-render-domain>.onrender.com`
3. Update `frontend/src/lib/api.js` baseURL to use `import.meta.env.VITE_API_URL`

## Pages Built
- **Login** — JWT auth with demo credential hints
- **Dashboard** — Quality score trend, uploads by source, record health, activity timeline
- **Upload Center** — Drag-drop with source type selection, quality report, upload history
- **Review Queue** — Hero screen: filterable records table, inline side panel with raw vs normalized comparison, approve/reject/lock/note actions
- **Record Detail** — Full record view with audit trail timeline
- **Audit History** — Global immutable log of all analyst actions
- **Facility Mapping** — Map raw codes to canonical facilities, unmapped code resolution
- **Settings** — Profile + architecture notes for interview reference
