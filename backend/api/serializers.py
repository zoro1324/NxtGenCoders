from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField(read_only=True)
    photo = serializers.SerializerMethodField(read_only=True)
    coords = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Report
        fields = [
            "id",
            "name",
            "title",
            "body",
            "location",
            "photo",
            "coords",
            "image_url",
            "comments",
            "likes",
            "shares",
            "created_at",
            "time",
        ]
        read_only_fields = ["id", "created_at", "time"]

    def get_time(self, obj: Report) -> str:
        # Simple relative time helper
        from datetime import datetime, timezone

        if not obj.created_at:
            return ""
        now = datetime.now(timezone.utc)
        diff = now - obj.created_at
        sec = int(diff.total_seconds())
        if sec < 60:
            return f"{sec}s ago"
        m = sec // 60
        if m < 60:
            return f"{m}m ago"
        h = m // 60
        if h < 24:
            return f"{h}h ago"
        d = h // 24
        if d < 7:
            return f"{d}d ago"
        return obj.created_at.date().isoformat()

    def _absolute_url(self, url: str | None) -> str | None:
        if not url:
            return None
        if url.startswith("http://") or url.startswith("https://"):
            return url
        request = self.context.get("request") if hasattr(self, 'context') else None
        if request is None:
            # Best-effort: ensure it starts with a slash
            return url if url.startswith("/") else f"/{url}"
        if url.startswith("/"):
            return request.build_absolute_uri(url)
        return request.build_absolute_uri(f"/{url}")

    def get_photo(self, obj: Report) -> str | None:
        # Prefer uploaded image if present, else external URL
        try:
            if getattr(obj, 'image', None) and obj.image:
                return self._absolute_url(obj.image.url)
        except Exception:
            pass
        return self._absolute_url(obj.image_url)

    def get_coords(self, obj: Report):
        c = getattr(obj, 'coords', None)
        if not c:
            return None
        # Return as {lat, lng}
        try:
            return {"lat": c.y, "lng": c.x}
        except Exception:
            return None

    def to_representation(self, instance: Report):
        data = super().to_representation(instance)
        data["image_url"] = self._absolute_url(data.get("image_url"))
        return data
