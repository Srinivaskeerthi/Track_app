# Key Engineering Decisions

While building this platform, I faced several ambiguities in the requirements and data formats. Here is how I resolved them and the engineering trade-offs I made.

---

## 1. Why I Chose CSV Uploads
* **The Ambiguity**: The requirement mentioned "ingesting data from various sources." It was unclear if we needed live API integrations, email scraping, or manual uploads.
* **My Decision**: I decided to focus exclusively on file uploads (CSV and Excel) for the prototype.
* **Why**: Sustainability data is rarely real-time. Facilities and procurement managers typically download quarterly exports from their ERP or billing systems. Building file ingestion handles 99% of corporate workflows without requiring complex API connections with legacy systems.
* **What I would ask the PM**: "Are there specific cloud APIs (like utility portals or corporate travel portals like Concur) that we should eventually integrate with directly, or is file upload the primary workflow?"

---

## 2. Why I Handled a Small Subset of SAP Exports
* **The Ambiguity**: SAP procurement exports can contain hundreds of columns representing tax codes, purchasing groups, GL accounts, and currency codes.
* **My Decision**: I focused only on 5 key columns: Plant/Location, Posting Date, Quantity, Unit, and Material/Fuel Type. 
* **Why**: Trying to parse a complete, raw SAP dump is an exercise in futility because every company customizes their SAP schema. By designing a flexible parser (`_clean_col` in `parsers.py`) that matches case-insensitive aliases, I made the ingestion resilient without requiring a rigid, fragile schema.
* **What I would ask the PM**: "Should we support standard SAP export configurations, or do we expect users to pre-format their spreadsheets?"

---

## 3. Why I Used Airport Codes (IATA) for Travel
* **The Ambiguity**: Travel sheets frequently list city names, airport names, or countries (e.g., "London Heathrow", "LHR", "London").
* **My Decision**: I restricted travel routing validation strictly to 3-letter IATA codes (like `BOM`, `DEL`, `LHR`).
* **Why**: Validating raw text city names is incredibly prone to typos and language issues. IATA codes are internationally standardized, extremely simple to validate using a regular expression (`^[A-Z]{3}$`), and are standard on all corporate travel agent receipts.
* **What I would ask the PM**: "Do travel agencies provide pre-calculated distances in their exports, or do we always need to calculate travel distances from flight routing?"

---

## 4. Why I Ignored PDF Utility Bills
* **The Ambiguity**: Utility companies (electricity, gas) almost always send bills as PDF files.
* **My Decision**: I intentionally ignored PDF parsing and only accepted CSV/Excel billing history tables.
* **Why**: Extracting data from PDFs dynamically is highly fragile. Every utility provider has a different layout, and changes to their invoice design immediately break traditional scrapers. Building an OCR pipeline is out of scope for a fast, reliable prototype.
* **What I would ask the PM**: "Should we prioritize a PDF parser using an AI OCR service (like AWS Textract) in the next phase, or are clients happy converting their bills to spreadsheets?"

---

## 5. Why I Chose PostgreSQL
* **The Ambiguity**: What database should store this unstructured ESG log data?
* **My Decision**: I chose PostgreSQL over SQLite or MongoDB.
* **Why**: 
  1. I needed a relational schema with foreign key constraints for multi-tenancy and audit logs to ensure total security.
  2. I needed to store messy, original row data exactly as it was uploaded. PostgreSQL’s native `JSONField` (using `JSONB` under the hood) allowed me to do this easily without needing a separate NoSQL database.
  3. Deploying to Render's free tier with Postgres is extremely standard and robust.

---

## 6. Resolving Render/Vercel Mismatch Typos at Runtime
* **The Ambiguity**: In production, users frequently make formatting mistakes when entering environment variables (like adding trailing slashes to Vercel API URLs or writing hosts like `* or service.onrender.com` in Render).
* **My Decision**: I chose to handle these typos **defensively in the code** rather than returning errors.
  * In `backend/settings.py`, I wrote a robust parser that cleans up both `ALLOWED_HOST` (singular) and `ALLOWED_HOSTS` (plural), and strips trailing slashes on CORS origins automatically to prevent build crashes.
  * In `frontend/src/lib/api.js`, I automatically stripped any trailing slash from `VITE_API_URL` to avoid broken `//api` double-slash network requests.
* **Why**: A minor environment configuration typo should never crash a build or block a deployment. Handling it defensively makes the application resilient.
