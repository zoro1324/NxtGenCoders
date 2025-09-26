from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
	list_display = ("id", "title", "name", "likes", "comments", "shares", "created_at")
	search_fields = ("title", "name")
