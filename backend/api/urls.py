from django.urls import path
from .views import reports_list, report_detail, seed_reports

urlpatterns = [
    path('reports/', reports_list, name='reports-list'),
    path('reports/<int:pk>/', report_detail, name='report-detail'),
    path('seed/', seed_reports, name='seed-reports'),
]
