"""
Data parsers for the 3 source types.

Each parser:
1. Reads the uploaded file (CSV or Excel)
2. Normalizes the row into a standard dict
3. Returns a list of dicts ready for validation + record creation

Design: Parsers are pure functions (no DB access).
They return normalized dicts; the view layer handles DB writes.
This makes parsers easy to unit test without a database.
"""

import io
import pandas as pd
from decimal import Decimal
from .validation import (
    parse_quantity, parse_date, normalize_unit,
    ValidationEngine, UNIT_NORMALIZATION
)


# ─────────────────────────── BASE PARSER ─────────────────────────────

def _read_file(file_obj, filename: str) -> pd.DataFrame:
    """Read CSV or Excel file into a DataFrame."""
    fname = filename.lower()
    content = file_obj.read()
    if fname.endswith('.xlsx') or fname.endswith('.xls'):
        try:
            return pd.read_excel(io.BytesIO(content), dtype=str)
        except Exception as e:
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
    elif fname.endswith('.csv'):
        # Try multiple encodings
        last_err = None
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                return pd.read_csv(io.BytesIO(content), dtype=str, encoding=encoding)
            except UnicodeDecodeError as ude:
                last_err = ude
                continue
            except Exception as e:
                raise ValueError(f"Failed to parse CSV file: {str(e)}")
        raise ValueError(f"Could not decode file. Please save as UTF-8 CSV. Details: {str(last_err)}")
    else:
        raise ValueError("Unsupported file format. Only CSV and Excel (.xlsx, .xls) files are supported.")


def _clean_col(df: pd.DataFrame, *candidates: str) -> str | None:
    """Find the first matching column name (case-insensitive)."""
    cols_lower = {c.lower().strip(): c for c in df.columns}
    for candidate in candidates:
        key = candidate.lower().strip()
        if key in cols_lower:
            return cols_lower[key]
    return None


def _val(row, col):
    """Safely get a value from a row, returning empty string if missing."""
    if col is None:
        return ''
    v = row.get(col, '')
    if pd.isna(v):
        return ''
    return str(v).strip()


# ─────────────────────────── SAP FUEL PARSER ─────────────────────────

def parse_sap_fuel(file_obj, filename: str, existing_facility_aliases: dict) -> list[dict]:
    """
    Parse SAP fuel & procurement export.

    Expected columns (flexible, we try multiple names):
    - Plant/Plant Code/Facility/Cost Center
    - Date/Posting Date/Document Date
    - Quantity/Amount/Volume
    - Unit/UoM/Unit of Measure
    - Material/Fuel Type/Description

    existing_facility_aliases: {raw_code: facility_id} for lookup
    """
    df = _read_file(file_obj, filename)
    df = df.where(pd.notna(df), '')

    # Column detection
    col_facility = _clean_col(df, 'plant', 'plant code', 'facility', 'cost center', 'site', 'location')
    col_date = _clean_col(df, 'posting date', 'document date', 'date', 'transaction date', 'period')
    col_qty = _clean_col(df, 'quantity', 'volume', 'amount', 'qty', 'consumption')
    col_unit = _clean_col(df, 'unit', 'uom', 'unit of measure', 'unit of measurement', 'uom text')
    col_material = _clean_col(df, 'material', 'fuel type', 'description', 'material description', 'item')
    col_vendor = _clean_col(df, 'vendor', 'supplier', 'vendor name')

    records = []
    for i, row in df.iterrows():
        raw_facility = _val(row, col_facility)
        raw_date = _val(row, col_date)
        raw_qty = _val(row, col_qty)
        raw_unit = _val(row, col_unit)
        raw_material = _val(row, col_material)

        qty = parse_quantity(raw_qty)
        record_date = parse_date(raw_date)
        normalized_unit, factor = normalize_unit(raw_unit)

        normalized_qty = None
        if qty is not None:
            try:
                normalized_qty = qty * factor
            except Exception:
                normalized_qty = qty

        facility_id = existing_facility_aliases.get(raw_facility.upper()) if raw_facility else None

        records.append({
            'source_row': i + 2,  # +2 because 0-indexed + header row
            'raw_data': row.to_dict(),
            'raw_facility_code': raw_facility,
            'facility_id': facility_id,
            'record_date': record_date,
            'normalized_quantity': normalized_qty,
            'normalized_unit': normalized_unit or '',
            'raw_unit': raw_unit,
            'category': raw_material or 'Fuel',
            'scope': 1,  # Fuel combustion = Scope 1
            'source_type': 'SAP_FUEL',
        })

    return records


# ─────────────────────────── UTILITY ELECTRICITY PARSER ──────────────

def parse_utility_electricity(file_obj, filename: str, existing_facility_aliases: dict) -> list[dict]:
    """
    Parse utility electricity billing CSV.

    Expected columns:
    - Meter ID/Account Number/Meter No
    - Billing Period/Period Start/Month
    - Consumption/Units/kWh/Energy
    - Unit/UoM
    - Facility/Site/Location (optional)
    """
    df = _read_file(file_obj, filename)
    df = df.where(pd.notna(df), '')

    col_meter = _clean_col(df, 'meter id', 'meter no', 'account number', 'account no', 'meter', 'account')
    col_date = _clean_col(df, 'billing period', 'period start', 'month', 'date', 'period', 'billing date')
    col_qty = _clean_col(df, 'consumption', 'units', 'kwh', 'energy', 'usage', 'quantity', 'reading')
    col_unit = _clean_col(df, 'unit', 'uom', 'unit of measure')
    col_facility = _clean_col(df, 'facility', 'site', 'location', 'plant', 'office')

    records = []
    for i, row in df.iterrows():
        raw_meter = _val(row, col_meter)
        raw_date = _val(row, col_date)
        raw_qty = _val(row, col_qty)
        raw_unit = _val(row, col_unit) or 'kWh'  # default for electricity
        raw_facility = _val(row, col_facility)

        qty = parse_quantity(raw_qty)
        record_date = parse_date(raw_date)
        normalized_unit, factor = normalize_unit(raw_unit)

        normalized_qty = None
        if qty is not None:
            try:
                normalized_qty = qty * factor
            except Exception:
                normalized_qty = qty

        lookup_key = (raw_meter or raw_facility or '').upper()
        facility_id = existing_facility_aliases.get(lookup_key)

        records.append({
            'source_row': i + 2,
            'raw_data': row.to_dict(),
            'raw_facility_code': raw_meter or raw_facility,
            'meter_id': raw_meter,
            'facility_id': facility_id,
            'record_date': record_date,
            'normalized_quantity': normalized_qty,
            'normalized_unit': normalized_unit or 'kWh',
            'raw_unit': raw_unit,
            'category': 'Electricity Grid',
            'scope': 2,  # Purchased electricity = Scope 2
            'source_type': 'UTILITY_ELEC',
        })

    return records


# ─────────────────────────── CORPORATE TRAVEL PARSER ─────────────────

def parse_corporate_travel(file_obj, filename: str, existing_facility_aliases: dict) -> list[dict]:
    """
    Parse corporate travel data (flights, hotels, ground transport).

    Expected columns:
    - Traveler/Employee/Name
    - Travel Date/Departure Date/Date
    - Origin/From/Departure City/From IATA
    - Destination/To/Arrival City/To IATA
    - Distance/km/Miles (optional)
    - Category/Type/Mode (FLIGHT/HOTEL/GROUND)
    - Booking Ref/Reference (for duplicate detection)
    """
    df = _read_file(file_obj, filename)
    df = df.where(pd.notna(df), '')

    col_traveler = _clean_col(df, 'traveler', 'employee', 'name', 'employee id', 'traveller', 'person')
    col_date = _clean_col(df, 'travel date', 'departure date', 'date', 'booking date', 'trip date')
    col_origin = _clean_col(df, 'origin', 'from', 'departure city', 'from iata', 'departure', 'from airport')
    col_dest = _clean_col(df, 'destination', 'to', 'arrival city', 'to iata', 'arrival', 'to airport')
    col_distance = _clean_col(df, 'distance', 'km', 'miles', 'distance km', 'distance miles')
    col_mode = _clean_col(df, 'category', 'type', 'mode', 'travel type', 'transport mode')
    col_traveler_id = _clean_col(df, 'employee id', 'emp id', 'traveler id', 'staff id')

    records = []
    for i, row in df.iterrows():
        raw_traveler = _val(row, col_traveler)
        raw_date = _val(row, col_date)
        raw_origin = _val(row, col_origin).upper()
        raw_dest = _val(row, col_dest).upper()
        raw_distance = _val(row, col_distance)
        raw_mode = _val(row, col_mode).upper() if col_mode else 'FLIGHT'
        raw_traveler_id = _val(row, col_traveler_id) or raw_traveler

        qty = parse_quantity(raw_distance)
        record_date = parse_date(raw_date)

        # Normalize travel mode
        travel_mode = 'FLIGHT'
        if any(x in raw_mode for x in ['HOTEL', 'ACCOMMODATION', 'LODGE']):
            travel_mode = 'HOTEL'
        elif any(x in raw_mode for x in ['GROUND', 'CAR', 'TAXI', 'TRAIN', 'BUS', 'RAIL']):
            travel_mode = 'GROUND'

        records.append({
            'source_row': i + 2,
            'raw_data': row.to_dict(),
            'raw_facility_code': '',
            'facility_id': None,
            'record_date': record_date,
            'normalized_quantity': qty,
            'normalized_unit': 'km',
            'raw_unit': 'km',
            'origin': raw_origin,
            'destination': raw_dest,
            'travel_mode': travel_mode,
            'traveler_id': raw_traveler_id,
            'category': f'Travel - {travel_mode.title()}',
            'scope': 3,  # Business travel = Scope 3
            'source_type': 'CORP_TRAVEL',
        })

    return records
