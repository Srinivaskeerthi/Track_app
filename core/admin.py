from django.contrib import admin
from .models import Organization, User, Facility, FacilityAlias, DataUpload, EnergyRecord, ValidationFlag, AuditLog


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'created_at']


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'organization', 'role', 'is_active']
    list_filter = ['role', 'organization']


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'facility_type', 'city', 'country', 'organization']
    list_filter = ['facility_type', 'organization']


@admin.register(FacilityAlias)
class FacilityAliasAdmin(admin.ModelAdmin):
    list_display = ['raw_code', 'facility', 'source_type']


@admin.register(DataUpload)
class DataUploadAdmin(admin.ModelAdmin):
    list_display = ['filename', 'source_type', 'status', 'quality_score', 'total_records', 'created_at']
    list_filter = ['source_type', 'status']
    readonly_fields = ['quality_score', 'total_records', 'valid_count', 'warning_count', 'error_count']


@admin.register(EnergyRecord)
class EnergyRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'upload', 'status', 'scope', 'normalized_quantity', 'normalized_unit', 'record_date']
    list_filter = ['status', 'scope', 'upload__source_type']
    readonly_fields = ['raw_data']


@admin.register(ValidationFlag)
class ValidationFlagAdmin(admin.ModelAdmin):
    list_display = ['flag_type', 'severity', 'field_name', 'record']
    list_filter = ['flag_type', 'severity']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'entity_type', 'user', 'timestamp']
    list_filter = ['action', 'entity_type']
    readonly_fields = ['old_value', 'new_value']
