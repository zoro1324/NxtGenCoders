from django.contrib import admin
from .models import Report, Civic


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
	list_display = ("id", "title", "name", "likes", "comments", "shares", "created_at")
	search_fields = ("title", "name")


@admin.register(Civic)
class CivicAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "phone_number", "created_at")
	search_fields = ("user__username", "user__email", "phone_number", "location")
