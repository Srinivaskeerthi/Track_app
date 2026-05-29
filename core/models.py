"""
Core data models for Breathe ESG platform.

Architecture Decision:
- Single Django app 'core' keeps all domain models together.
  This makes it easy to explain the full data model in one place
  during an interview without jumping across apps.
- We use a custom User model (AbstractUser) so we can add the
  organization FK without a separate Profile model. Switching to a
  custom user model AFTER initial migration is painful, so we do it
  from the start.
- JSONField (raw_data) stores the original CSV row so we can always
  show the analyst what came in before normalization. No separate
  "raw" table needed.
"""

import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


# ─────────────────────────── TENANT ROOT ────────────────────────────

class Organization(models.Model):
    """
    Multi-tenancy root. Every piece of data belongs to an org.
    ADR: Row-level tenancy (FK on every model) rather than schema-per-tenant.
    Simpler to implement, sufficient for this scale, easy to query across orgs
    for admin purposes. Schema-per-tenant would require dynamic DB routing.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


# ─────────────────────────── USERS ──────────────────────────────────

class User(AbstractUser):
    """
    Custom user with org FK and role.
    Roles: ADMIN (full access), ANALYST (review/approve), VIEWER (read-only)
    """
    ROLE_ANALYST = 'ANALYST'
    ROLE_ADMIN = 'ADMIN'
    ROLE_VIEWER = 'VIEWER'
    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_ANALYST, 'Analyst'),
        (ROLE_VIEWER, 'Viewer'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='users', null=True, blank=True
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_ANALYST)
    avatar_initials = models.CharField(max_length=3, blank=True)

    def save(self, *args, **kwargs):
        if not self.avatar_initials:
            parts = [self.first_name[:1], self.last_name[:1]]
            self.avatar_initials = ''.join(p for p in parts if p) or self.username[:2].upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"


# ─────────────────────────── FACILITIES ─────────────────────────────

class Facility(models.Model):
    """
    Canonical facility/plant/site.
    ADR: Separating facilities from aliases allows raw source codes like
    "PLT-001" or "PLANT_MUMBAI" to map to a single canonical record.
    This is the core of the facility mapping feature.
    """
    FACILITY_TYPES = [
        ('PLANT', 'Manufacturing Plant'),
        ('OFFICE', 'Office'),
        ('WAREHOUSE', 'Warehouse'),
        ('DATA_CENTER', 'Data Center'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='facilities')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)  # canonical code, e.g. "FAC-MUM-001"
    facility_type = models.CharField(max_length=20, choices=FACILITY_TYPES, default='PLANT')
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='India')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

    class Meta:
        unique_together = ['organization', 'code']
        ordering = ['name']


class FacilityAlias(models.Model):
    """
    Maps raw source codes → canonical Facility.
    e.g. "PLT-001", "PLANT_MUMBAI", "1001" all → Facility("Mumbai Plant")
    Analyst creates these via the Facility Mapping screen.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name='aliases')
    raw_code = models.CharField(max_length=100)  # exactly as it appears in source data
    source_type = models.CharField(max_length=30, blank=True)  # which source this alias appears in
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.raw_code} → {self.facility.name}"

    class Meta:
        unique_together = ['facility', 'raw_code']


# ─────────────────────────── UPLOADS ────────────────────────────────

class DataUpload(models.Model):
    """
    Tracks each file ingested into the system.
    One upload → many EnergyRecords.
    Quality score computed after parsing.
    """
    SOURCE_SAP_FUEL = 'SAP_FUEL'
    SOURCE_UTILITY_ELEC = 'UTILITY_ELEC'
    SOURCE_CORP_TRAVEL = 'CORP_TRAVEL'
    SOURCE_CHOICES = [
        (SOURCE_SAP_FUEL, 'SAP Fuel & Procurement'),
        (SOURCE_UTILITY_ELEC, 'Utility Electricity'),
        (SOURCE_CORP_TRAVEL, 'Corporate Travel'),
    ]

    STATUS_PENDING = 'PENDING'
    STATUS_PROCESSING = 'PROCESSING'
    STATUS_REVIEW = 'REVIEW'
    STATUS_APPROVED = 'APPROVED'
    STATUS_FAILED = 'FAILED'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_REVIEW, 'Under Review'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_FAILED, 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='uploads')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploads')
    filename = models.CharField(max_length=255)
    source_type = models.CharField(max_length=30, choices=SOURCE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    # Quality metrics computed after parsing
    total_records = models.IntegerField(default=0)
    valid_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    quality_score = models.IntegerField(default=0)  # 0-100

    # Period covered by the data
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    processing_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def compute_quality_score(self):
        """
        Quality Score formula (easy to explain in interview):
        - Errors are heavy: deduct up to 60 points
        - Warnings are light: deduct up to 20 points
        - Result clamped 0-100
        """
        if self.total_records == 0:
            self.quality_score = 0
            return
        score = 100
        score -= (self.error_count / self.total_records) * 60
        score -= (self.warning_count / self.total_records) * 20
        self.quality_score = max(0, round(score))

    def __str__(self):
        return f"{self.filename} ({self.source_type}) — {self.status}"

    class Meta:
        ordering = ['-created_at']


# ─────────────────────────── ENERGY RECORDS ─────────────────────────

class EnergyRecord(models.Model):
    """
    The normalized record — the heart of the system.

    ADR: We store BOTH raw_data (jsonb) and normalized fields.
    This lets the analyst compare what came in vs what we understood.
    It also means we never lose source data.

    Scope classification:
    - Scope 1: Direct emissions (fuel combustion on-site)
    - Scope 2: Purchased electricity
    - Scope 3: Business travel, supply chain
    """
    SCOPE_1 = 1
    SCOPE_2 = 2
    SCOPE_3 = 3
    SCOPE_CHOICES = [(1, 'Scope 1'), (2, 'Scope 2'), (3, 'Scope 3')]

    STATUS_VALID = 'VALID'
    STATUS_WARNING = 'WARNING'
    STATUS_ERROR = 'ERROR'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'
    STATUS_LOCKED = 'LOCKED'
    STATUS_CHOICES = [
        (STATUS_VALID, 'Valid'),
        (STATUS_WARNING, 'Warning'),
        (STATUS_ERROR, 'Error'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_LOCKED, 'Locked'),
    ]

    # Units we normalize to
    UNIT_KWH = 'kWh'
    UNIT_LITRES = 'L'
    UNIT_KG = 'kg'
    UNIT_KM = 'km'
    UNIT_M3 = 'm³'
    UNIT_CHOICES = [
        (UNIT_KWH, 'kWh'),
        (UNIT_LITRES, 'Litres'),
        (UNIT_KG, 'Kilograms'),
        (UNIT_KM, 'Kilometres'),
        (UNIT_M3, 'Cubic Metres'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    upload = models.ForeignKey(DataUpload, on_delete=models.CASCADE, related_name='records')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='records')
    facility = models.ForeignKey(
        Facility, on_delete=models.SET_NULL, null=True, blank=True, related_name='records'
    )

    # Source data (immutable)
    raw_data = models.JSONField()       # original CSV row as dict
    source_row = models.IntegerField()  # row number in source file (for debugging)

    # Normalized fields
    record_date = models.DateField(null=True, blank=True)
    normalized_quantity = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    normalized_unit = models.CharField(max_length=10, choices=UNIT_CHOICES, blank=True)
    scope = models.IntegerField(choices=SCOPE_CHOICES, null=True, blank=True)
    category = models.CharField(max_length=100, blank=True)  # e.g. "Diesel", "Electricity Grid"

    # For travel records
    origin = models.CharField(max_length=10, blank=True)       # IATA code
    destination = models.CharField(max_length=10, blank=True)  # IATA code
    travel_mode = models.CharField(max_length=30, blank=True)  # FLIGHT / HOTEL / GROUND

    # Review state
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_VALID)
    analyst_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_records'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='locked_records'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Record {self.source_row} | {self.upload.source_type} | {self.status}"

    class Meta:
        ordering = ['-created_at']


# ─────────────────────────── VALIDATION FLAGS ───────────────────────

class ValidationFlag(models.Model):
    """
    Per-record issue detected by the ValidationEngine.
    One record can have multiple flags.

    Flag types map to specific validation rules — easy to explain:
    "MISSING_UNIT means the source row had no unit column, so we
    can't normalize the quantity."
    """
    FLAG_MISSING_QUANTITY = 'MISSING_QUANTITY'
    FLAG_MISSING_UNIT = 'MISSING_UNIT'
    FLAG_INVALID_DATE = 'INVALID_DATE'
    FLAG_DUPLICATE = 'DUPLICATE'
    FLAG_UNKNOWN_FACILITY = 'UNKNOWN_FACILITY'
    FLAG_INVALID_UNIT = 'INVALID_UNIT'
    FLAG_NEGATIVE_VALUE = 'NEGATIVE_VALUE'
    FLAG_BILLING_OVERLAP = 'BILLING_OVERLAP'
    FLAG_MISSING_DISTANCE = 'MISSING_DISTANCE'
    FLAG_UNKNOWN_AIRPORT = 'UNKNOWN_AIRPORT'
    FLAG_ANOMALY_SPIKE = 'ANOMALY_SPIKE'
    FLAG_DUPLICATE_BOOKING = 'DUPLICATE_BOOKING'

    FLAG_TYPE_CHOICES = [
        (FLAG_MISSING_QUANTITY, 'Missing Quantity'),
        (FLAG_MISSING_UNIT, 'Missing Unit'),
        (FLAG_INVALID_DATE, 'Invalid Date'),
        (FLAG_DUPLICATE, 'Duplicate Record'),
        (FLAG_UNKNOWN_FACILITY, 'Unknown Facility'),
        (FLAG_INVALID_UNIT, 'Invalid Unit'),
        (FLAG_NEGATIVE_VALUE, 'Negative Value'),
        (FLAG_BILLING_OVERLAP, 'Billing Period Overlap'),
        (FLAG_MISSING_DISTANCE, 'Missing Distance'),
        (FLAG_UNKNOWN_AIRPORT, 'Unknown Airport Code'),
        (FLAG_ANOMALY_SPIKE, 'Anomaly: Spike Detected'),
        (FLAG_DUPLICATE_BOOKING, 'Duplicate Booking'),
    ]

    SEV_ERROR = 'ERROR'
    SEV_WARNING = 'WARNING'
    SEV_INFO = 'INFO'
    SEVERITY_CHOICES = [
        (SEV_ERROR, 'Error'),
        (SEV_WARNING, 'Warning'),
        (SEV_INFO, 'Info'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey(EnergyRecord, on_delete=models.CASCADE, related_name='flags')
    flag_type = models.CharField(max_length=50, choices=FLAG_TYPE_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    field_name = models.CharField(max_length=100, blank=True)  # which field triggered this
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.severity}: {self.flag_type} on record {self.record_id}"

    class Meta:
        ordering = ['severity', 'flag_type']


# ─────────────────────────── AUDIT TRAIL ────────────────────────────

class AuditLog(models.Model):
    """
    Immutable audit trail of every analyst action.

    ADR: We use a dedicated AuditLog model rather than django-simple-history.
    Reason: django-simple-history creates shadow tables and is harder to
    explain in an interview. This model is transparent — every field has
    an obvious purpose. We can show the evaluator exactly how it works.

    old_value/new_value store only the changed fields, not the entire object.
    This keeps the JSON small and readable.
    """
    ACTION_CREATED = 'CREATED'
    ACTION_UPDATED = 'UPDATED'
    ACTION_APPROVED = 'APPROVED'
    ACTION_REJECTED = 'REJECTED'
    ACTION_LOCKED = 'LOCKED'
    ACTION_NOTE_ADDED = 'NOTE_ADDED'
    ACTION_UPLOAD = 'UPLOAD'
    ACTION_FACILITY_MAPPED = 'FACILITY_MAPPED'
    ACTION_CHOICES = [
        (ACTION_CREATED, 'Record Created'),
        (ACTION_UPDATED, 'Record Updated'),
        (ACTION_APPROVED, 'Record Approved'),
        (ACTION_REJECTED, 'Record Rejected'),
        (ACTION_LOCKED, 'Record Locked'),
        (ACTION_NOTE_ADDED, 'Note Added'),
        (ACTION_UPLOAD, 'File Uploaded'),
        (ACTION_FACILITY_MAPPED, 'Facility Mapped'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)

    # Generic reference: can point to a Record, Upload, or Facility
    entity_type = models.CharField(max_length=50)  # 'EnergyRecord', 'DataUpload', 'Facility'
    entity_id = models.CharField(max_length=36)     # UUID as string

    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)

    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.action} by {self.user} at {self.timestamp}"

    class Meta:
        ordering = ['-timestamp']
