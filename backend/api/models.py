from django.contrib.gis.db import models
from django.contrib.auth import get_user_model


class Report(models.Model):
	name = models.CharField(max_length=120)
	title = models.CharField(max_length=255)
	body = models.TextField(blank=True)
	# Either a stored uploaded image or an external URL
	image = models.ImageField(upload_to='reports/pictures', blank=True, null=True)
	image_url = models.URLField(blank=True, null=True)
	# Optional voice message (audio file)
	voice = models.FileField(upload_to='reports/voice/', blank=True, null=True)
	# Human-readable address or coordinates string
	location = models.CharField(max_length=255, blank=True)
	# Geospatial point (lon/lat) using WGS84
	coords = models.PointField(geography=True, srid=4326, null=True, blank=True)
	comments = models.PositiveIntegerField(default=0)
	likes = models.PositiveIntegerField(default=0)
	shares = models.PositiveIntegerField(default=0)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"{self.title} by {self.name}"


# Link to Django's default User model for civic profile
User = get_user_model()


class Civic(models.Model):
	"""User profile details for citizens."""
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="civic")
	phone_number = models.CharField(max_length=30, blank=True)
	# Geospatial point for user's location (WGS84)
	location = models.PointField(geography=True, srid=4326, null=True, blank=True)
	# Optional profile photo
	avatar = models.ImageField(upload_to='profiles/', null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:
		return f"Civic({self.user.username if self.user_id else 'unbound'})"
