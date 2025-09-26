from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Report
        fields = [
            "id",
            "name",
            "title",
            "body",
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
