"""
API Views for Breathe ESG platform.
All views require authentication (set globally in DRF settings).
"""

from django.utils import timezone
from django.db.models import Avg, Count, Q
from rest_framework import generics, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import (
    Organization, User, Facility, FacilityAlias,
    DataUpload, EnergyRecord, ValidationFlag, AuditLog
)
from .serializers import (
    LoginSerializer, UserSerializer, OrganizationSerializer,
    FacilitySerializer, FacilityMapAliasSerializer,
    EnergyRecordListSerializer, EnergyRecordDetailSerializer, RecordActionSerializer,
    DataUploadSerializer, DataUploadCreateSerializer,
    AuditLogSerializer,
)
from .parsers import parse_sap_fuel, parse_utility_electricity, parse_corporate_travel
from .validation import ValidationEngine


def create_audit_log(user, org, action, entity_type, entity_id,
                     old_value=None, new_value=None, reason=''):
    AuditLog.objects.create(
        organization=org,
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        old_value=old_value,
        new_value=new_value,
        reason=reason,
    )


# ─────────────────────────── AUTH ────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        return Response({'detail': 'Logged out.'})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


# ─────────────────────────── DASHBOARD ───────────────────────────────

class DashboardStatsView(APIView):
    def get(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No organization'}, status=400)

        uploads = DataUpload.objects.filter(organization=org)
        records = EnergyRecord.objects.filter(organization=org)

        pending_review = records.filter(status__in=['VALID', 'WARNING', 'ERROR']).count()
        approved = records.filter(status='APPROVED').count()
        errors = records.filter(status='ERROR').count()
        avg_score = uploads.aggregate(avg=Avg('quality_score'))['avg'] or 0

        # Uploads by source type
        by_source = {}
        for s, _ in DataUpload.SOURCE_CHOICES:
            by_source[s] = uploads.filter(source_type=s).count()

        # Recent quality scores (last 10 uploads)
        recent = list(
            uploads.order_by('-created_at')[:10]
            .values('filename', 'quality_score', 'source_type', 'created_at')
        )
        for r in recent:
            r['created_at'] = r['created_at'].isoformat()

        anomaly_count = ValidationFlag.objects.filter(
            record__organization=org,
            flag_type='ANOMALY_SPIKE'
        ).count()

        return Response({
            'total_uploads': uploads.count(),
            'total_records': records.count(),
            'pending_review': pending_review,
            'approved_records': approved,
            'error_records': errors,
            'avg_quality_score': round(avg_score, 1),
            'uploads_by_source': by_source,
            'recent_quality_scores': recent,
            'anomaly_count': anomaly_count,
        })


class DashboardActivityView(APIView):
    def get(self, request):
        org = request.user.organization
        logs = AuditLog.objects.filter(organization=org).order_by('-timestamp')[:20]
        return Response(AuditLogSerializer(logs, many=True).data)


# ─────────────────────────── UPLOADS ─────────────────────────────────

class DataUploadListView(generics.ListAPIView):
    serializer_class = DataUploadSerializer

    def get_queryset(self):
        return DataUpload.objects.filter(
            organization=self.request.user.organization
        ).order_by('-created_at')


class DataUploadDetailView(generics.RetrieveAPIView):
    serializer_class = DataUploadSerializer

    def get_queryset(self):
        return DataUpload.objects.filter(organization=self.request.user.organization)


class DataUploadCreateView(APIView):
    """
    POST /api/uploads/
    Accepts file + source_type. Runs parser + validation synchronously.
    ADR: Synchronous processing is fine for files up to ~10k rows.
    For larger files we'd use Celery, but that adds deployment complexity
    that isn't justified by the assignment scope.
    """

    def post(self, request):
        serializer = DataUploadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']
        source_type = serializer.validated_data['source_type']
        org = request.user.organization

        if not org:
            return Response({'error': 'User has no organization'}, status=400)

        # Validate file extension before creating the database record
        filename = file.name.lower()
        if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
            return Response(
                {'error': 'Unsupported file format. Only CSV and Excel (.xlsx, .xls) files are supported.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create upload record
        upload = DataUpload.objects.create(
            organization=org,
            uploaded_by=request.user,
            filename=file.name,
            source_type=source_type,
            status=DataUpload.STATUS_PROCESSING,
        )

        try:
            # Get existing facility aliases for lookup
            aliases = {
                fa.raw_code.upper(): fa.facility_id
                for fa in FacilityAlias.objects.filter(facility__organization=org)
            }

            # Parse based on source type
            if source_type == DataUpload.SOURCE_SAP_FUEL:
                parsed_rows = parse_sap_fuel(file, file.name, aliases)
            elif source_type == DataUpload.SOURCE_UTILITY_ELEC:
                parsed_rows = parse_utility_electricity(file, file.name, aliases)
            else:
                parsed_rows = parse_corporate_travel(file, file.name, aliases)

            # Build existing keys for duplicate detection
            existing_keys = set()
            engine = ValidationEngine()

            records_to_create = []
            flags_to_create = []

            valid_count = warning_count = error_count = 0

            for row in parsed_rows:
                # Run validation
                if source_type == DataUpload.SOURCE_SAP_FUEL:
                    result = engine.validate_sap(row, existing_keys)
                    dup_key = (row.get('raw_facility_code', ''),
                               str(row.get('record_date', '')),
                               str(row.get('normalized_quantity', '')),
                               row.get('raw_unit', ''))
                elif source_type == DataUpload.SOURCE_UTILITY_ELEC:
                    result = engine.validate_electricity(row, existing_keys)
                    dup_key = (row.get('meter_id', ''),
                               str(row.get('record_date', '')),
                               str(row.get('normalized_quantity', '')))
                else:
                    result = engine.validate_travel(row, existing_keys)
                    dup_key = (row.get('traveler_id', ''),
                               row.get('origin', ''),
                               row.get('destination', ''),
                               str(row.get('record_date', '')))

                existing_keys.add(dup_key)

                rec_status = result.record_status
                if rec_status == 'ERROR':
                    error_count += 1
                elif rec_status == 'WARNING':
                    warning_count += 1
                else:
                    valid_count += 1

                # Get facility if mapped
                facility_id = row.get('facility_id')

                raw_data = {}
                for k, v in row.get('raw_data', {}).items():
                    raw_data[str(k)] = str(v) if v is not None else ''

                record = EnergyRecord(
                    upload=upload,
                    organization=org,
                    facility_id=facility_id,
                    raw_data=raw_data,
                    source_row=row['source_row'],
                    record_date=row.get('record_date'),
                    normalized_quantity=row.get('normalized_quantity'),
                    normalized_unit=row.get('normalized_unit', ''),
                    scope=row.get('scope'),
                    category=row.get('category', ''),
                    origin=row.get('origin', ''),
                    destination=row.get('destination', ''),
                    travel_mode=row.get('travel_mode', ''),
                    status=rec_status,
                )
                records_to_create.append((record, result.flags))

            # Bulk create records
            created_records = EnergyRecord.objects.bulk_create(
                [r for r, _ in records_to_create]
            )

            # Create flags
            all_flags = []
            for record, flag_list in zip(created_records, [f for _, f in records_to_create]):
                for flag_data in flag_list:
                    all_flags.append(ValidationFlag(
                        record=record,
                        flag_type=flag_data['flag_type'],
                        severity=flag_data['severity'],
                        field_name=flag_data['field_name'],
                        message=flag_data['message'],
                    ))
            ValidationFlag.objects.bulk_create(all_flags)

            # Update upload stats
            upload.total_records = len(created_records)
            upload.valid_count = valid_count
            upload.warning_count = warning_count
            upload.error_count = error_count
            upload.status = DataUpload.STATUS_REVIEW
            upload.compute_quality_score()
            upload.save()

            # Audit log
            create_audit_log(
                request.user, org, AuditLog.ACTION_UPLOAD,
                'DataUpload', upload.id,
                new_value={
                    'filename': file.name,
                    'source_type': source_type,
                    'total_records': upload.total_records,
                    'quality_score': upload.quality_score,
                }
            )

            return Response(DataUploadSerializer(upload).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            upload.status = DataUpload.STATUS_FAILED
            upload.processing_notes = str(e)
            upload.save()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UploadQualityReportView(APIView):
    def get(self, request, pk):
        try:
            upload = DataUpload.objects.get(pk=pk, organization=request.user.organization)
        except DataUpload.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        flags_summary = {}
        for flag in ValidationFlag.objects.filter(record__upload=upload):
            key = flag.flag_type
            if key not in flags_summary:
                flags_summary[key] = {'count': 0, 'severity': flag.severity, 'message': flag.message}
            flags_summary[key]['count'] += 1

        return Response({
            'upload': DataUploadSerializer(upload).data,
            'flags_summary': flags_summary,
        })


# ─────────────────────────── RECORDS ─────────────────────────────────

class EnergyRecordFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name='status')
    source_type = django_filters.CharFilter(field_name='upload__source_type')
    scope = django_filters.NumberFilter(field_name='scope')
    facility = django_filters.UUIDFilter(field_name='facility__id')
    upload = django_filters.UUIDFilter(field_name='upload__id')
    date_from = django_filters.DateFilter(field_name='record_date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='record_date', lookup_expr='lte')

    class Meta:
        model = EnergyRecord
        fields = ['status', 'scope']


class EnergyRecordListView(generics.ListAPIView):
    serializer_class = EnergyRecordListSerializer
    filterset_class = EnergyRecordFilter
    search_fields = ['category', 'origin', 'destination', 'upload__filename']
    ordering_fields = ['record_date', 'created_at', 'normalized_quantity', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        return EnergyRecord.objects.filter(
            organization=self.request.user.organization
        ).select_related('upload', 'facility', 'reviewed_by').prefetch_related('flags')


class EnergyRecordDetailView(generics.RetrieveAPIView):
    serializer_class = EnergyRecordDetailSerializer

    def get_queryset(self):
        return EnergyRecord.objects.filter(
            organization=self.request.user.organization
        ).select_related('upload', 'facility', 'reviewed_by', 'locked_by').prefetch_related('flags')


class RecordApproveView(APIView):
    def patch(self, request, pk):
        try:
            record = EnergyRecord.objects.get(pk=pk, organization=request.user.organization)
        except EnergyRecord.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if record.status == 'LOCKED':
            return Response({'error': 'Record is locked and cannot be modified.'}, status=400)

        serializer = RecordActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = record.status
        record.status = EnergyRecord.STATUS_APPROVED
        record.reviewed_by = request.user
        record.reviewed_at = timezone.now()
        if serializer.validated_data.get('notes'):
            record.analyst_notes = serializer.validated_data['notes']
        record.save()

        create_audit_log(
            request.user, request.user.organization,
            AuditLog.ACTION_APPROVED, 'EnergyRecord', record.id,
            old_value={'status': old_status},
            new_value={'status': 'APPROVED'},
            reason=serializer.validated_data.get('reason', ''),
        )
        return Response(EnergyRecordListSerializer(record).data)


class RecordRejectView(APIView):
    def patch(self, request, pk):
        try:
            record = EnergyRecord.objects.get(pk=pk, organization=request.user.organization)
        except EnergyRecord.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if record.status == 'LOCKED':
            return Response({'error': 'Record is locked and cannot be modified.'}, status=400)

        serializer = RecordActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = record.status
        record.status = EnergyRecord.STATUS_REJECTED
        record.reviewed_by = request.user
        record.reviewed_at = timezone.now()
        if serializer.validated_data.get('notes'):
            record.analyst_notes = serializer.validated_data['notes']
        record.save()

        create_audit_log(
            request.user, request.user.organization,
            AuditLog.ACTION_REJECTED, 'EnergyRecord', record.id,
            old_value={'status': old_status},
            new_value={'status': 'REJECTED'},
            reason=serializer.validated_data.get('reason', ''),
        )
        return Response(EnergyRecordListSerializer(record).data)


class RecordLockView(APIView):
    def patch(self, request, pk):
        try:
            record = EnergyRecord.objects.get(pk=pk, organization=request.user.organization)
        except EnergyRecord.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if record.status != 'APPROVED':
            return Response({'error': 'Only approved records can be locked.'}, status=400)

        record.status = EnergyRecord.STATUS_LOCKED
        record.locked_by = request.user
        record.locked_at = timezone.now()
        record.save()

        create_audit_log(
            request.user, request.user.organization,
            AuditLog.ACTION_LOCKED, 'EnergyRecord', record.id,
            new_value={'status': 'LOCKED'},
        )
        return Response(EnergyRecordListSerializer(record).data)


class RecordNoteView(APIView):
    def post(self, request, pk):
        try:
            record = EnergyRecord.objects.get(pk=pk, organization=request.user.organization)
        except EnergyRecord.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        note = request.data.get('note', '').strip()
        if not note:
            return Response({'error': 'Note cannot be empty.'}, status=400)

        old_notes = record.analyst_notes
        record.analyst_notes = note
        record.save(update_fields=['analyst_notes', 'updated_at'])

        create_audit_log(
            request.user, request.user.organization,
            AuditLog.ACTION_NOTE_ADDED, 'EnergyRecord', record.id,
            old_value={'analyst_notes': old_notes},
            new_value={'analyst_notes': note},
        )
        return Response({'analyst_notes': record.analyst_notes})


# ─────────────────────────── AUDIT LOG ───────────────────────────────

class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.filter(organization=self.request.user.organization)
        entity_id = self.request.query_params.get('entity_id')
        entity_type = self.request.query_params.get('entity_type')
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        return qs.select_related('user').order_by('-timestamp')


# ─────────────────────────── FACILITIES ──────────────────────────────

class FacilityListCreateView(generics.ListCreateAPIView):
    serializer_class = FacilitySerializer

    def get_queryset(self):
        return Facility.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related('aliases')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class FacilityDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = FacilitySerializer

    def get_queryset(self):
        return Facility.objects.filter(organization=self.request.user.organization)


class FacilityMapAliasView(APIView):
    def post(self, request):
        serializer = FacilityMapAliasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            facility = Facility.objects.get(
                pk=serializer.validated_data['facility_id'],
                organization=request.user.organization
            )
        except Facility.DoesNotExist:
            return Response({'error': 'Facility not found'}, status=404)

        alias, created = FacilityAlias.objects.get_or_create(
            facility=facility,
            raw_code=serializer.validated_data['raw_code'],
            defaults={
                'source_type': serializer.validated_data.get('source_type', ''),
                'created_by': request.user,
            }
        )

        create_audit_log(
            request.user, request.user.organization,
            AuditLog.ACTION_FACILITY_MAPPED, 'FacilityAlias', alias.id,
            new_value={
                'raw_code': alias.raw_code,
                'facility': facility.name,
            }
        )

        return Response(FacilitySerializer(facility).data)


class UnmappedFacilitiesView(APIView):
    """Returns raw facility codes that have no mapping."""
    def get(self, request):
        from django.db.models import F
        unmapped = EnergyRecord.objects.filter(
            organization=request.user.organization,
            facility__isnull=True,
        ).exclude(
            raw_data__has_key='facility_code'
        ).values_list('raw_data', flat=True)

        # Extract unique raw codes
        codes = set()
        for record in EnergyRecord.objects.filter(
            organization=request.user.organization,
            facility__isnull=True,
        ).values('raw_data', 'upload__source_type'):
            rd = record.get('raw_data', {})
            for k in ['plant', 'facility', 'meter id', 'site']:
                if k in rd and rd[k]:
                    codes.add((rd[k], record.get('upload__source_type', '')))
                    break

        return Response([
            {'raw_code': code, 'source_type': stype}
            for code, stype in sorted(codes)
        ])


# ─────────────────────────── ORG ─────────────────────────────────────

class OrganizationView(generics.RetrieveUpdateAPIView):
    serializer_class = OrganizationSerializer

    def get_object(self):
        return self.request.user.organization
