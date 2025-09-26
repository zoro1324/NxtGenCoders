from django.db import models


class Report(models.Model):
	name = models.CharField(max_length=120)
	title = models.CharField(max_length=255)
	body = models.TextField(blank=True)
	image_url = models.URLField(blank=True, null=True)
	comments = models.PositiveIntegerField(default=0)
	likes = models.PositiveIntegerField(default=0)
	shares = models.PositiveIntegerField(default=0)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"{self.title} by {self.name}"
