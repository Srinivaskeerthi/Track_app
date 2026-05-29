# Architectural Trade-Offs

To deliver a high-quality prototype within the project timeline, I intentionally deferred building certain complex modules. Here are the three major features I skipped, my reasoning, and how they should be built in a real-world product.

---

## 1. Automated Carbon Emission Calculations (API-Driven)

### Why I did not build it:
Calculating exact metric tons of CO2-equivalent ($tCO_2e$) requires matching consumption data against hyper-localized, time-specific emission factors (e.g., the specific grid mix of Karnataka in 2024 for electricity, or the direct EPA factor for diesel). Building or maintaining this database of factors—or integrating with an external paid ESG API like Climatiq—would add significant cost, configuration, and API dependency to a simple prototype.

### What I would do in a real product:
I would integrate an asynchronous worker queue (like Celery) that takes approved `EnergyRecords`, calls an external carbon calculations engine (like Climatiq or carbonkit), and caches the resulting emission factor and calculation path on the record before locking it.

### Why it was out of scope:
The core problem of ESG reporting is **data ingestion, cleansing, and auditable verification**. If you cannot ingest the data cleanly and map the facilities, the calculation math is useless. I chose to focus 100% of my effort on the ingestion, warning flags, and the analyst review queue.

---

## 2. Utility Bill PDF Parsing (OCR Engine)

### Why I did not build it:
Utility providers (like BESCOM, Tata Power, or British Gas) deliver monthly invoices as PDFs. Extracting structured energy data from unstructured, scanned PDFs requires building a heavy OCR processing pipeline using machine learning models or services like AWS Textract, Google Document AI, or custom parser scripts for *every* unique utility company. 

### What I would do in a real product:
I would build an ingestion bucket where users drop their PDF bills. An asynchronous Lambda function would run the PDF through an OCR model trained specifically on utility invoice structures, extract the bill date, meter number, and consumption value, and stage it in the `DataUpload` queue for analyst review.

### Why it was out of scope:
It is an extremely complex machine-learning problem that is separate from database design and user workflows. Almost all utility providers offer a "Billing History Export" in Excel or CSV on their portal, which fits our existing, highly robust spreadsheet parser perfectly.

---

## 3. Real-Time Multi-Analyst Collaboration (WebSockets)

### Why I did not build it:
When multiple analysts are looking at the review queue, one analyst might approve a record while another is viewing it. I chose to use standard HTTP request-response patterns rather than setting up real-time WebSockets or Server-Sent Events (SSE).

### What I would do in a real product:
I would use Django Channels or a real-time sync layer to broadcast live queue updates. If Analyst A locks or rejects a row, that row would instantly turn red or disappear on Analyst B's screen without requiring a manual page refresh.

### Why it was out of scope:
WebSockets introduce massive state-tracking and connection management complexity. For a small ESG compliance team, the likelihood of two people reviewing the exact same row at the exact same second is extremely low. I implemented robust database-level checks instead: if a record is already `LOCKED` or `APPROVED`, the backend immediately rejects any concurrent edits with a clean error message, keeping the data completely safe.
