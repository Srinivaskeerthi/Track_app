"""
Seed command: creates demo data for the Breathe ESG platform.
Run: python manage.py seed_demo

Creates:
- 1 Organization (Acme Manufacturing)
- 2 Users (admin + analyst)
- 4 Facilities
- 3 DataUploads with realistic records, flags, and audit logs
"""

import random
from decimal import Decimal
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import (
    Organization, User, Facility, FacilityAlias,
    DataUpload, EnergyRecord, ValidationFlag, AuditLog
)


class Command(BaseCommand):
    help = 'Seed demo data for Breathe ESG platform'

    def handle(self, *args, **options):
        self.stdout.write('Seeding demo data...')

        # Organization
        org, _ = Organization.objects.get_or_create(
            slug='acme-manufacturing',
            defaults={'name': 'Acme Manufacturing Ltd.'}
        )

        # Users
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@acme.com',
                'first_name': 'Alex',
                'last_name': 'Morgan',
                'role': User.ROLE_ADMIN,
                'organization': org,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin_user.set_password('demo1234')
            admin_user.save()

        analyst, created = User.objects.get_or_create(
            username='analyst',
            defaults={
                'email': 'analyst@acme.com',
                'first_name': 'Priya',
                'last_name': 'Sharma',
                'role': User.ROLE_ANALYST,
                'organization': org,
            }
        )
        if created:
            analyst.set_password('demo1234')
            analyst.save()

        # Facilities
        facilities_data = [
            ('Mumbai Plant', 'FAC-MUM-001', 'PLANT', 'Mumbai', 'India'),
            ('Pune Warehouse', 'FAC-PUN-002', 'WAREHOUSE', 'Pune', 'India'),
            ('Delhi Office', 'FAC-DEL-003', 'OFFICE', 'Delhi', 'India'),
            ('Chennai Plant', 'FAC-CHE-004', 'PLANT', 'Chennai', 'India'),
        ]
        facilities = []
        for name, code, ftype, city, country in facilities_data:
            fac, _ = Facility.objects.get_or_create(
                organization=org, code=code,
                defaults={'name': name, 'facility_type': ftype, 'city': city, 'country': country}
            )
            facilities.append(fac)

        # Facility aliases
        alias_data = [
            (facilities[0], 'PLT-001', 'SAP_FUEL'),
            (facilities[0], 'MUMBAI-PLANT', 'SAP_FUEL'),
            (facilities[1], 'WH-PUNE', 'UTILITY_ELEC'),
            (facilities[2], 'DELHI-HO', 'UTILITY_ELEC'),
            (facilities[3], 'CHE001', 'SAP_FUEL'),
        ]
        for fac, raw_code, stype in alias_data:
            FacilityAlias.objects.get_or_create(
                facility=fac, raw_code=raw_code,
                defaults={'source_type': stype, 'created_by': admin_user}
            )

        # ── Upload 1: SAP Fuel (mostly good data) ──────────────────────
        upload1, _ = DataUpload.objects.get_or_create(
            filename='SAP_Fuel_Q1_2024.csv',
            organization=org,
            defaults={
                'uploaded_by': analyst,
                'source_type': DataUpload.SOURCE_SAP_FUEL,
                'status': DataUpload.STATUS_REVIEW,
            }
        )

        # Create SAP fuel records
        sap_records_data = [
            (facilities[0], date(2024, 1, 15), Decimal('5200'), 'L', 'Diesel', 'VALID'),
            (facilities[0], date(2024, 1, 31), Decimal('4800'), 'L', 'Diesel', 'VALID'),
            (facilities[3], date(2024, 2, 10), Decimal('3100'), 'L', 'Diesel', 'VALID'),
            (facilities[3], date(2024, 2, 15), Decimal('52000'), 'L', 'Diesel', 'WARNING'),  # spike
            (None,          date(2024, 3, 5),  None,            '',  'Diesel', 'ERROR'),     # missing qty+unit
            (None,          None,              Decimal('1200'), 'L', 'LPG',    'ERROR'),     # invalid date
            (facilities[0], date(2024, 3, 20), Decimal('4950'), 'L', 'Diesel', 'APPROVED'),
            (facilities[1], date(2024, 3, 25), Decimal('800'),  'kg', 'LPG',   'VALID'),
        ]

        existing_records = EnergyRecord.objects.filter(upload=upload1)
        if not existing_records.exists():
            for i, (fac, rdate, qty, unit, cat, rec_status) in enumerate(sap_records_data):
                raw = {
                    'Plant': fac.code if fac else 'UNKNOWN',
                    'Posting Date': str(rdate) if rdate else '',
                    'Quantity': str(qty) if qty else '',
                    'Unit': unit,
                    'Material': cat,
                }
                record = EnergyRecord.objects.create(
                    upload=upload1, organization=org,
                    facility=fac, raw_data=raw, source_row=i + 2,
                    record_date=rdate,
                    normalized_quantity=qty,
                    normalized_unit=unit or 'L',
                    scope=1, category=cat, status=rec_status,
                )

                if rec_status == 'WARNING':
                    ValidationFlag.objects.create(
                        record=record, flag_type='ANOMALY_SPIKE', severity='WARNING',
                        field_name='quantity',
                        message='Diesel consumption of 52,000L is 8.4σ above the 6-month average (4,900L) for this facility.',
                    )
                elif rec_status == 'ERROR':
                    if qty is None:
                        ValidationFlag.objects.create(
                            record=record, flag_type='MISSING_QUANTITY', severity='ERROR',
                            field_name='quantity',
                            message='Fuel quantity is missing. Cannot normalize without a value.',
                        )
                    if not unit:
                        ValidationFlag.objects.create(
                            record=record, flag_type='MISSING_UNIT', severity='ERROR',
                            field_name='unit',
                            message='Unit of measurement is missing.',
                        )
                    if rdate is None:
                        ValidationFlag.objects.create(
                            record=record, flag_type='INVALID_DATE', severity='ERROR',
                            field_name='date',
                            message='Date is missing or could not be parsed.',
                        )

                if rec_status == 'APPROVED':
                    record.reviewed_by = analyst
                    record.reviewed_at = timezone.now() - timedelta(hours=2)
                    record.analyst_notes = 'Verified against purchase order PO-2024-0892. Correct.'
                    record.save()

            # Update upload stats
            upload1.total_records = 8
            upload1.valid_count = 4
            upload1.warning_count = 1
            upload1.error_count = 2
            upload1.status = DataUpload.STATUS_REVIEW
            upload1.period_start = date(2024, 1, 1)
            upload1.period_end = date(2024, 3, 31)
            upload1.compute_quality_score()
            upload1.save()

        # ── Upload 2: Utility Electricity ──────────────────────────────
        upload2, _ = DataUpload.objects.get_or_create(
            filename='Utility_Electricity_Jan-Mar_2024.csv',
            organization=org,
            defaults={
                'uploaded_by': admin_user,
                'source_type': DataUpload.SOURCE_UTILITY_ELEC,
                'status': DataUpload.STATUS_REVIEW,
            }
        )

        existing_records2 = EnergyRecord.objects.filter(upload=upload2)
        if not existing_records2.exists():
            elec_data = [
                (facilities[0], 'MTR-001', date(2024, 1, 31), Decimal('42500'), 'kWh', 'VALID'),
                (facilities[0], 'MTR-001', date(2024, 2, 29), Decimal('44200'), 'kWh', 'VALID'),
                (facilities[0], 'MTR-001', date(2024, 3, 31), Decimal('41800'), 'kWh', 'VALID'),
                (facilities[2], 'MTR-002', date(2024, 1, 31), Decimal('8200'), 'kWh', 'VALID'),
                (facilities[2], 'MTR-002', date(2024, 2, 29), Decimal('7900'), 'kWh', 'VALID'),
                (facilities[2], 'MTR-002', date(2024, 3, 31), Decimal('185000'), 'kWh', 'WARNING'),  # spike
                (None,          '',        date(2024, 1, 31), Decimal('3200'), 'kWh', 'WARNING'),   # no meter
            ]
            for i, (fac, meter, rdate, qty, unit, rec_status) in enumerate(elec_data):
                raw = {
                    'Meter ID': meter,
                    'Billing Period': str(rdate),
                    'Consumption': str(qty),
                    'Unit': unit,
                    'Facility': fac.name if fac else '',
                }
                record = EnergyRecord.objects.create(
                    upload=upload2, organization=org,
                    facility=fac, raw_data=raw, source_row=i + 2,
                    record_date=rdate, normalized_quantity=qty,
                    normalized_unit='kWh', scope=2,
                    category='Electricity Grid', status=rec_status,
                )
                if rec_status == 'WARNING':
                    if qty > 100000:
                        ValidationFlag.objects.create(
                            record=record, flag_type='ANOMALY_SPIKE', severity='WARNING',
                            field_name='consumption',
                            message=f'Monthly consumption of {qty:,} kWh is 11.2σ above the 3-month average (8,033 kWh).',
                        )
                    else:
                        ValidationFlag.objects.create(
                            record=record, flag_type='UNKNOWN_FACILITY', severity='WARNING',
                            field_name='meter_id',
                            message='Meter ID is missing. Cannot attribute to a facility.',
                        )

            upload2.total_records = 7
            upload2.valid_count = 4
            upload2.warning_count = 2
            upload2.error_count = 0
            upload2.status = DataUpload.STATUS_REVIEW
            upload2.period_start = date(2024, 1, 1)
            upload2.period_end = date(2024, 3, 31)
            upload2.compute_quality_score()
            upload2.save()

        # ── Upload 3: Corporate Travel ─────────────────────────────────
        upload3, _ = DataUpload.objects.get_or_create(
            filename='Corporate_Travel_Q1_2024.xlsx',
            organization=org,
            defaults={
                'uploaded_by': analyst,
                'source_type': DataUpload.SOURCE_CORP_TRAVEL,
                'status': DataUpload.STATUS_REVIEW,
            }
        )

        existing_records3 = EnergyRecord.objects.filter(upload=upload3)
        if not existing_records3.exists():
            travel_data = [
                ('BOM', 'DEL', date(2024, 1, 10), Decimal('1148'), 'FLIGHT', 'VALID'),
                ('DEL', 'LHR', date(2024, 1, 15), Decimal('6729'), 'FLIGHT', 'VALID'),
                ('BOM', 'SIN', date(2024, 2, 5),  Decimal('4174'), 'FLIGHT', 'VALID'),
                ('DEL', 'BOM', date(2024, 2, 12), Decimal('1148'), 'FLIGHT', 'VALID'),
                ('DEL', 'BOM', date(2024, 2, 12), Decimal('1148'), 'FLIGHT', 'ERROR'),   # duplicate
                ('XYZ', 'ABC', date(2024, 3, 1),  None,            'FLIGHT', 'WARNING'), # unknown codes + no distance
            ]
            for i, (origin, dest, rdate, qty, mode, rec_status) in enumerate(travel_data):
                raw = {
                    'Traveler': 'EMP-00' + str(i + 1),
                    'Travel Date': str(rdate),
                    'Origin': origin,
                    'Destination': dest,
                    'Distance (km)': str(qty) if qty else '',
                    'Category': mode,
                }
                record = EnergyRecord.objects.create(
                    upload=upload3, organization=org,
                    facility=None, raw_data=raw, source_row=i + 2,
                    record_date=rdate, normalized_quantity=qty,
                    normalized_unit='km', scope=3,
                    origin=origin, destination=dest, travel_mode=mode,
                    category=f'Travel - {mode.title()}', status=rec_status,
                )
                if rec_status == 'ERROR':
                    ValidationFlag.objects.create(
                        record=record, flag_type='DUPLICATE_BOOKING', severity='ERROR',
                        field_name='row',
                        message='A booking for the same traveler, route, and date already exists (row 5).',
                    )
                elif rec_status == 'WARNING':
                    ValidationFlag.objects.create(
                        record=record, flag_type='UNKNOWN_AIRPORT', severity='WARNING',
                        field_name='origin',
                        message="Airport code 'XYZ' is not a valid IATA code.",
                    )
                    ValidationFlag.objects.create(
                        record=record, flag_type='MISSING_DISTANCE', severity='WARNING',
                        field_name='distance',
                        message='Distance not provided. Must be entered manually or derived from route.',
                    )

            upload3.total_records = 6
            upload3.valid_count = 4
            upload3.warning_count = 1
            upload3.error_count = 1
            upload3.status = DataUpload.STATUS_REVIEW
            upload3.period_start = date(2024, 1, 1)
            upload3.period_end = date(2024, 3, 31)
            upload3.compute_quality_score()
            upload3.save()

        # ── Audit Logs ─────────────────────────────────────────────────
        if not AuditLog.objects.filter(organization=org).exists():
            actions = [
                (analyst, AuditLog.ACTION_UPLOAD, 'DataUpload', str(upload1.id),
                 None, {'filename': upload1.filename, 'quality_score': upload1.quality_score},
                 '', timezone.now() - timedelta(days=3)),
                (admin_user, AuditLog.ACTION_UPLOAD, 'DataUpload', str(upload2.id),
                 None, {'filename': upload2.filename, 'quality_score': upload2.quality_score},
                 '', timezone.now() - timedelta(days=2)),
                (analyst, AuditLog.ACTION_APPROVED, 'EnergyRecord',
                 str(EnergyRecord.objects.filter(upload=upload1, status='APPROVED').first().id),
                 {'status': 'VALID'}, {'status': 'APPROVED'},
                 'Verified against PO-2024-0892', timezone.now() - timedelta(hours=5)),
                (analyst, AuditLog.ACTION_FACILITY_MAPPED, 'FacilityAlias', str(org.id),
                 None, {'raw_code': 'PLT-001', 'facility': 'Mumbai Plant'},
                 '', timezone.now() - timedelta(days=2, hours=3)),
                (admin_user, AuditLog.ACTION_UPLOAD, 'DataUpload', str(upload3.id),
                 None, {'filename': upload3.filename, 'quality_score': upload3.quality_score},
                 '', timezone.now() - timedelta(days=1)),
            ]
            for user, action, etype, eid, old, new, reason, ts in actions:
                AuditLog.objects.create(
                    organization=org, user=user, action=action,
                    entity_type=etype, entity_id=eid,
                    old_value=old, new_value=new, reason=reason,
                    timestamp=ts,
                )

        self.stdout.write(self.style.SUCCESS(
            '\nDemo data seeded successfully!\n'
            '   Login: admin / demo1234\n'
            '   Login: analyst / demo1234\n'
        ))
