from django.contrib.gis.db import models


class Report(models.Model):
	name = models.CharField(max_length=120)
	title = models.CharField(max_length=255)
	body = models.TextField(blank=True)
	# Either a stored uploaded image or an external URL
	image = models.ImageField(upload_to='reports/', blank=True, null=True)
	image_url = models.URLField(blank=True, null=True)
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
