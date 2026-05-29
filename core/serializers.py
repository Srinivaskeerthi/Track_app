from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import (
    Organization, User, Facility, FacilityAlias,
    DataUpload, EnergyRecord, ValidationFlag, AuditLog
)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(**data)
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')
        return {'user': user}


class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'role', 'avatar_initials', 'organization', 'organization_name']
        read_only_fields = ['id', 'avatar_initials']


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'created_at']


class FacilityAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacilityAlias
        fields = ['id', 'raw_code', 'source_type', 'created_at']


class FacilitySerializer(serializers.ModelSerializer):
    aliases = FacilityAliasSerializer(many=True, read_only=True)
    record_count = serializers.SerializerMethodField()

    class Meta:
        model = Facility
        fields = ['id', 'name', 'code', 'facility_type', 'city', 'country',
                  'is_active', 'aliases', 'record_count', 'created_at']

    def get_record_count(self, obj):
        return obj.records.count()


class FacilityMapAliasSerializer(serializers.Serializer):
    raw_code = serializers.CharField()
    facility_id = serializers.UUIDField()
    source_type = serializers.CharField(required=False, default='')


class ValidationFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationFlag
        fields = ['id', 'flag_type', 'severity', 'field_name', 'message']


class EnergyRecordListSerializer(serializers.ModelSerializer):
    flags = ValidationFlagSerializer(many=True, read_only=True)
    facility_name = serializers.CharField(source='facility.name', read_only=True, default=None)
    source_type = serializers.CharField(source='upload.source_type', read_only=True)
    upload_filename = serializers.CharField(source='upload.filename', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EnergyRecord
        fields = [
            'id', 'source_type', 'upload_filename', 'facility_name',
            'record_date', 'normalized_quantity', 'normalized_unit',
            'scope', 'category', 'origin', 'destination', 'travel_mode',
            'status', 'analyst_notes', 'reviewed_by_name', 'reviewed_at',
            'locked_at', 'flags', 'source_row', 'created_at',
        ]

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None


class EnergyRecordDetailSerializer(serializers.ModelSerializer):
    flags = ValidationFlagSerializer(many=True, read_only=True)
    facility = FacilitySerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    locked_by = UserSerializer(read_only=True)
    source_type = serializers.CharField(source='upload.source_type', read_only=True)
    upload_filename = serializers.CharField(source='upload.filename', read_only=True)

    class Meta:
        model = EnergyRecord
        fields = [
            'id', 'source_type', 'upload_filename', 'facility',
            'raw_data', 'source_row',
            'record_date', 'normalized_quantity', 'normalized_unit',
            'scope', 'category', 'origin', 'destination', 'travel_mode',
            'status', 'analyst_notes',
            'reviewed_by', 'reviewed_at', 'locked_at', 'locked_by',
            'flags', 'created_at', 'updated_at',
        ]


class RecordActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class DataUploadSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DataUpload
        fields = [
            'id', 'filename', 'source_type', 'source_type_display',
            'status', 'status_display',
            'total_records', 'valid_count', 'warning_count', 'error_count', 'quality_score',
            'period_start', 'period_end', 'processing_notes',
            'uploaded_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'total_records', 'valid_count',
                            'warning_count', 'error_count', 'quality_score',
                            'created_at', 'updated_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None


class DataUploadCreateSerializer(serializers.Serializer):
    file = serializers.FileField()
    source_type = serializers.ChoiceField(choices=DataUpload.SOURCE_CHOICES)


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_initials = serializers.CharField(source='user.avatar_initials', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'action_display', 'entity_type', 'entity_id',
            'old_value', 'new_value', 'reason',
            'user_name', 'user_initials', 'timestamp',
        ]

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'System'
