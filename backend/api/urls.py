from django.urls import path
from .views import reports_list, report_detail, seed_reports, signup, login, me, health

urlpatterns = [
    path('reports/', reports_list, name='reports-list'),
    path('reports/<int:pk>/', report_detail, name='report-detail'),
    path('seed/', seed_reports, name='seed-reports'),
    path('auth/signup/', signup, name='signup'),
    path('auth/login/', login, name='login'),
    path('auth/me/', me, name='me'),
    path('health/', health, name='health'),
]
