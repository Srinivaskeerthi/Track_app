from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, LogoutView, MeView,
    DashboardStatsView, DashboardActivityView,
    DataUploadListView, DataUploadDetailView, DataUploadCreateView, UploadQualityReportView,
    EnergyRecordListView, EnergyRecordDetailView,
    RecordApproveView, RecordRejectView, RecordLockView, RecordNoteView,
    AuditLogListView,
    FacilityListCreateView, FacilityDetailView, FacilityMapAliasView, UnmappedFacilitiesView,
    OrganizationView,
)

urlpatterns = [
    # Auth
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='me'),

    # Dashboard
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('dashboard/activity/', DashboardActivityView.as_view(), name='dashboard_activity'),

    # Uploads
    path('uploads/', DataUploadCreateView.as_view(), name='upload_create'),
    path('uploads/list/', DataUploadListView.as_view(), name='upload_list'),
    path('uploads/<uuid:pk>/', DataUploadDetailView.as_view(), name='upload_detail'),
    path('uploads/<uuid:pk>/quality-report/', UploadQualityReportView.as_view(), name='upload_quality'),

    # Records (Review Queue)
    path('records/', EnergyRecordListView.as_view(), name='record_list'),
    path('records/<uuid:pk>/', EnergyRecordDetailView.as_view(), name='record_detail'),
    path('records/<uuid:pk>/approve/', RecordApproveView.as_view(), name='record_approve'),
    path('records/<uuid:pk>/reject/', RecordRejectView.as_view(), name='record_reject'),
    path('records/<uuid:pk>/lock/', RecordLockView.as_view(), name='record_lock'),
    path('records/<uuid:pk>/notes/', RecordNoteView.as_view(), name='record_note'),

    # Audit
    path('audit-logs/', AuditLogListView.as_view(), name='audit_logs'),

    # Facilities
    path('facilities/', FacilityListCreateView.as_view(), name='facility_list'),
    path('facilities/<uuid:pk>/', FacilityDetailView.as_view(), name='facility_detail'),
    path('facilities/map-alias/', FacilityMapAliasView.as_view(), name='facility_map_alias'),
    path('facilities/unmapped/', UnmappedFacilitiesView.as_view(), name='unmapped_facilities'),

    # Organization
    path('organizations/current/', OrganizationView.as_view(), name='org_current'),
]
