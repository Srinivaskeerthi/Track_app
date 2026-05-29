# Data Source Research & Specifications

For this prototype, I researched realistic corporate data exports and created representative sample spreadsheets. Here is the documentation of that research, my data design choices, and real-world failure modes.

---

## 1. SAP Fuel & Procurement (Scope 1)

### Real-World Format Researched:
I researched standard inventory and procurement logs from the **SAP MM (Materials Management)** module—specifically transaction exports like `MB51` (Material Documents List) and invoice verification logs.

### Selected Fields:
* **Plant / site** *(e.g., PLT-001, Site-A)*: The internal SAP identifier for a physical location.
* **Posting Date** *(e.g., 2024-01-15)*: The day the transaction was legally logged in the ledger.
* **Quantity** *(e.g., 5000, 1200.5)*: The physical volume or weight.
* **Unit of Measure (UoM)** *(e.g., L, Litre, KG)*: The physical unit.
* **Material / Fuel Type** *(e.g., Diesel, Natural Gas, LPG)*: Determines the emission factor.

### Why I Selected These:
These columns are the absolute bare minimum needed to calculate direct combustion footprint. SAP is famous for outputting dozens of irrelevant procurement columns (e.g., purchasing group, tax codes, vendor IDs). Stripping all that noise away makes data mapping simple.

### My Assumptions:
* Every procurement line represents fuel that was actually combusted (Scope 1).
* Plant codes in SAP are consistent across the fiscal year.

### Real-World Failure Modes:
* **Unit conversions**: Standard SAP exports frequently output custom units like `drum` or `pallet`. Without a localized conversion dictionary, the parser will fail to determine the physical litres or kilograms.
* **Bulk Storage**: A factory might buy 50,000 litres of diesel in Q1 but only burn it in Q3. Treating procurement as immediate combustion causes massive, inaccurate spikes in quarterly reporting.

---

## 2. Utility Electricity (Scope 2)

### Real-World Format Researched:
I researched billing exports from commercial power portals (such as utility billing history tables).

### Selected Fields:
* **Meter ID / Account No** *(e.g., MTR-9081)*: The unique legal identifier for the physical power hookup.
* **Billing Period** *(e.g., 2024-01-01 to 2024-01-31)*: The date range of electricity use.
* **Consumption** *(e.g., 14200)*: The quantity of active power used.
* **Unit** *(e.g., kWh, MWh)*: Standard electrical energy units.
* **Facility / Site** *(optional, e.g., Bangalore HQ)*: The human-readable office location.

### Why I Selected These:
Commercial properties often have multiple meters in a single building. Tracking by **Meter ID** rather than just a general address is the only way an auditor can verify that no bills were missed or double-counted.

### My Assumptions:
* The meter ID remains fixed and doesn't change due to physical hardware replacement.
* All bills represent a standard monthly period.

### Real-World Failure Modes:
* **Estimated Bills**: Utilities frequently estimate consumption for months when they don't physically read the meter, then apply a massive correction bill later. This creates artificial negative or spiked consumption records.
* **Shared Tenants**: If a company rents a single floor in a co-working space, they don't get a utility bill. They pay a flat service fee, meaning we have to estimate electricity footprint based on square footage rather than real meter logs.

---

## 3. Corporate Travel (Scope 3)

### Real-World Format Researched:
I researched quarterly travel agency reports (e.g., typical CSV exports from booking agents like Concur or local travel desks).

### Selected Fields:
* **Employee Name** *(e.g., Priya Sharma)*: Tracks the individual traveler.
* **Travel Date** *(e.g., 2024-02-12)*: The date of the journey.
* **Origin / Destination** *(e.g., BOM, DEL, LHR)*: 3-letter IATA airport codes.
* **Distance** *(e.g., 1148)*: Distance traveled (in kilometers or miles).
* **Category** *(e.g., Flight, Ground, Hotel)*: The travel mode.

### Why I Selected These:
Business travel is notoriously chaotic. Using **IATA codes** (like `BOM` for Mumbai, `LHR` for London) is the most standard, foolproof way to calculate exact flight distances and apply flight-specific altitude radiative forcing multipliers.

### My Assumptions:
* Flights are direct (we calculate straight-line distance between origin and destination IATA codes).
* Distance listed in the Excel file is accurate.

### Real-World Failure Modes:
* **Layovers**: A flight from Delhi to San Francisco with a layover in Tokyo has a much higher carbon footprint than a direct flight, but our simple origin-destination parser will only calculate the direct distance, underreporting emissions.
* **Class of Travel**: Booking reports rarely list if a flight was Business Class or Economy. Since a Business Class seat takes up more physical space on a plane, its carbon footprint is up to 3 times higher, which standard travel logs completely miss.
