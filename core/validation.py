"""
Validation Engine for Breathe ESG platform.

Design principle: All validation rules live in ONE place.
This makes it easy to audit, test, and explain during review.

Each validator returns a list of (flag_type, severity, field_name, message) tuples.
The engine applies all validators and computes the record status.
"""

import re
from datetime import datetime, date
from decimal import Decimal, InvalidOperation


# ─────────────────────────── VALID VALUES ───────────────────────────

VALID_FUEL_UNITS = {'L', 'l', 'litre', 'litres', 'liter', 'liters',
                    'kg', 'KG', 'kilogram', 'kilograms',
                    'm3', 'm³', 'M3', 'cubic metre', 'cubic meter',
                    'ton', 'tonne', 'MT', 'mt',
                    'kWh', 'kwh', 'KWH',
                    'MJ', 'GJ', 'BTU'}

VALID_ELEC_UNITS = {'kWh', 'kwh', 'KWH', 'MWh', 'mwh', 'MWH', 'GWh', 'units'}

VALID_IATA_PATTERN = re.compile(r'^[A-Z]{3}$')

# Common IATA codes for validation (not exhaustive, just major ones)
KNOWN_IATA_CODES = {
    'BOM', 'DEL', 'MAA', 'BLR', 'HYD', 'CCU', 'AMD', 'PNQ', 'GOI', 'COK',
    'LHR', 'JFK', 'LAX', 'CDG', 'FRA', 'DXB', 'SIN', 'HKG', 'NRT', 'SYD',
    'ORD', 'ATL', 'DFW', 'MIA', 'SFO', 'SEA', 'BOS', 'MSP', 'DTW', 'PHX',
    'AMS', 'IST', 'DOH', 'AUH', 'KUL', 'ICN', 'PEK', 'PVG', 'BKK', 'MNL',
}


# ─────────────────────────── UNIT NORMALIZATION ──────────────────────

UNIT_NORMALIZATION = {
    # Fuel → Litres
    'l': 'L', 'litre': 'L', 'litres': 'L', 'liter': 'L', 'liters': 'L', 'L': 'L',
    # Fuel → kg
    'kg': 'kg', 'KG': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    # Fuel → m³
    'm3': 'm³', 'M3': 'm³', 'cubic metre': 'm³', 'cubic meter': 'm³', 'm³': 'm³',
    # Electricity → kWh
    'kwh': 'kWh', 'KWH': 'kWh', 'kWh': 'kWh',
    'mwh': 'MWh', 'MWH': 'MWh', 'MWh': 'MWh',
    'units': 'kWh',
    # Travel → km
    'km': 'km', 'KM': 'km', 'kilometre': 'km', 'kilometers': 'km', 'miles': 'km',
}

UNIT_CONVERSION = {
    'MWh': Decimal('1000'),      # MWh → kWh
    'GWh': Decimal('1000000'),   # GWh → kWh
    'miles': Decimal('1.60934'), # miles → km
    'tonne': Decimal('1000'),    # tonne → kg
    'MT': Decimal('1000'),
    'ton': Decimal('1000'),
    'MJ': Decimal('0.27778'),    # MJ → kWh
    'GJ': Decimal('277.78'),     # GJ → kWh
}


def normalize_unit(raw_unit: str):
    """Returns (canonical_unit, conversion_factor)"""
    if not raw_unit:
        return None, Decimal('1')
    cleaned = raw_unit.strip()
    canonical = UNIT_NORMALIZATION.get(cleaned, cleaned)
    factor = UNIT_CONVERSION.get(cleaned, Decimal('1'))
    return canonical, factor


def parse_quantity(raw_value) -> Decimal | None:
    """Safely parse a quantity value to Decimal."""
    if raw_value is None or str(raw_value).strip() == '':
        return None
    try:
        cleaned = str(raw_value).replace(',', '').strip()
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def parse_date(raw_date) -> date | None:
    """Try multiple date formats."""
    if not raw_date or str(raw_date).strip() == '':
        return None
    formats = [
        '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y',
        '%Y/%m/%d', '%d-%b-%Y', '%b-%d-%Y', '%Y%m%d',
        '%d.%m.%Y', '%m.%d.%Y',
    ]
    s = str(raw_date).strip()
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


# ─────────────────────────── VALIDATION RULES ────────────────────────

class ValidationResult:
    def __init__(self):
        self.flags = []  # list of dicts
        self.has_error = False
        self.has_warning = False

    def add(self, flag_type, severity, field_name, message):
        self.flags.append({
            'flag_type': flag_type,
            'severity': severity,
            'field_name': field_name,
            'message': message,
        })
        if severity == 'ERROR':
            self.has_error = True
        elif severity == 'WARNING':
            self.has_warning = True

    @property
    def record_status(self):
        if self.has_error:
            return 'ERROR'
        if self.has_warning:
            return 'WARNING'
        return 'VALID'


class ValidationEngine:
    """
    Stateless validation engine.
    Call validate_sap(), validate_electricity(), or validate_travel()
    depending on source type.
    """

    def validate_sap(self, normalized_record: dict, existing_keys: set) -> ValidationResult:
        result = ValidationResult()
        r = normalized_record

        # Rule 1: Missing quantity
        if r.get('normalized_quantity') is None:
            result.add('MISSING_QUANTITY', 'ERROR', 'quantity',
                       'Fuel quantity is missing or not a number. Cannot normalize without a value.')

        # Rule 2: Missing unit
        if not r.get('raw_unit', '').strip():
            result.add('MISSING_UNIT', 'ERROR', 'unit',
                       'Unit of measurement is missing. Cannot determine fuel type or volume.')

        # Rule 3: Invalid unit
        elif r.get('raw_unit', '').strip() not in VALID_FUEL_UNITS:
            result.add('INVALID_UNIT', 'ERROR', 'unit',
                       f"Unit '{r.get('raw_unit')}' is not a recognized fuel unit. "
                       f"Expected one of: L, kg, m³, kWh, MJ, GJ, ton.")

        # Rule 4: Invalid date
        if r.get('record_date') is None:
            result.add('INVALID_DATE', 'ERROR', 'date',
                       'Date is missing or could not be parsed. Tried formats: YYYY-MM-DD, DD/MM/YYYY, DD-Mon-YYYY.')

        # Rule 5: Unknown facility
        if not r.get('facility_id') and not r.get('raw_facility_code', '').strip():
            result.add('UNKNOWN_FACILITY', 'WARNING', 'facility_code',
                       'No plant/facility code found. Record cannot be attributed to a facility.')
        elif not r.get('facility_id') and r.get('raw_facility_code'):
            result.add('UNKNOWN_FACILITY', 'WARNING', 'facility_code',
                       f"Plant code '{r.get('raw_facility_code')}' has no facility mapping. "
                       f"Create a mapping in Facility Mapping to resolve.")

        # Rule 6: Negative quantity
        qty = r.get('normalized_quantity')
        if qty is not None and qty < 0:
            result.add('NEGATIVE_VALUE', 'ERROR', 'quantity',
                       f'Fuel quantity is negative ({qty}). Negative consumption is physically impossible.')

        # Rule 7: Duplicate check
        dup_key = (
            r.get('raw_facility_code', ''),
            str(r.get('record_date', '')),
            str(r.get('normalized_quantity', '')),
            r.get('raw_unit', ''),
        )
        if dup_key in existing_keys:
            result.add('DUPLICATE', 'ERROR', 'row',
                       'This row appears to be a duplicate of an already-processed record '
                       '(same facility + date + quantity + unit).')

        return result

    def validate_electricity(self, normalized_record: dict, existing_keys: set) -> ValidationResult:
        result = ValidationResult()
        r = normalized_record

        # Missing quantity
        if r.get('normalized_quantity') is None:
            result.add('MISSING_QUANTITY', 'ERROR', 'quantity',
                       'Electricity consumption value is missing or not a number.')

        # Negative value
        qty = r.get('normalized_quantity')
        if qty is not None and qty < 0:
            result.add('NEGATIVE_VALUE', 'ERROR', 'quantity',
                       f'Electricity reading is negative ({qty}). Check for meter reversal or data entry error.')

        # Missing unit
        if not r.get('raw_unit', '').strip():
            result.add('MISSING_UNIT', 'ERROR', 'unit',
                       'Electricity unit is missing. Expected kWh, MWh, or units.')
        elif r.get('raw_unit', '').strip() not in VALID_ELEC_UNITS:
            result.add('INVALID_UNIT', 'WARNING', 'unit',
                       f"Unit '{r.get('raw_unit')}' is unusual for electricity data. Expected kWh or MWh.")

        # Invalid date
        if r.get('record_date') is None:
            result.add('INVALID_DATE', 'ERROR', 'date',
                       'Billing period date is missing or could not be parsed.')

        # Missing meter ID
        if not r.get('meter_id', '').strip():
            result.add('UNKNOWN_FACILITY', 'WARNING', 'meter_id',
                       'Meter ID is missing. Cannot attribute consumption to a specific meter/facility.')

        # Anomaly: spike detection (done separately in AnomalyDetector)
        if r.get('is_spike'):
            result.add('ANOMALY_SPIKE', 'WARNING', 'quantity',
                       f"Consumption of {qty} {r.get('raw_unit')} is more than 3σ above the "
                       f"6-month average for this facility. Please verify before approving.")

        return result

    def validate_travel(self, normalized_record: dict, existing_keys: set) -> ValidationResult:
        result = ValidationResult()
        r = normalized_record

        # Missing origin
        if not r.get('origin', '').strip():
            result.add('MISSING_QUANTITY', 'ERROR', 'origin',
                       'Travel origin is missing. Cannot calculate distance or scope 3 emissions.')

        # Missing destination
        if not r.get('destination', '').strip():
            result.add('MISSING_QUANTITY', 'ERROR', 'destination',
                       'Travel destination is missing.')

        # Unknown IATA codes
        origin = r.get('origin', '').strip().upper()
        dest = r.get('destination', '').strip().upper()

        if origin and not VALID_IATA_PATTERN.match(origin):
            result.add('UNKNOWN_AIRPORT', 'WARNING', 'origin',
                       f"'{origin}' does not look like a valid 3-letter IATA code.")
        elif origin and origin not in KNOWN_IATA_CODES:
            result.add('UNKNOWN_AIRPORT', 'WARNING', 'origin',
                       f"Airport code '{origin}' is not in the known IATA code list. Please verify.")

        if dest and not VALID_IATA_PATTERN.match(dest):
            result.add('UNKNOWN_AIRPORT', 'WARNING', 'destination',
                       f"'{dest}' does not look like a valid 3-letter IATA code.")
        elif dest and dest not in KNOWN_IATA_CODES:
            result.add('UNKNOWN_AIRPORT', 'WARNING', 'destination',
                       f"Airport code '{dest}' is not in the known IATA code list. Please verify.")

        # Missing distance
        if r.get('normalized_quantity') is None:
            result.add('MISSING_DISTANCE', 'WARNING', 'distance',
                       'Distance is not provided. It will need to be derived from origin/destination codes '
                       'or entered manually before approval.')

        # Invalid date
        if r.get('record_date') is None:
            result.add('INVALID_DATE', 'ERROR', 'date',
                       'Travel date is missing or could not be parsed.')

        # Duplicate booking check
        dup_key = (
            r.get('traveler_id', ''),
            r.get('origin', ''),
            r.get('destination', ''),
            str(r.get('record_date', '')),
        )
        if dup_key in existing_keys:
            result.add('DUPLICATE_BOOKING', 'ERROR', 'row',
                       'A booking for the same traveler, route, and date already exists. '
                       'This may be a duplicate booking or system export error.')

        return result
