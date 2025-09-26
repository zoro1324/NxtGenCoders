from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.gis.geos import Point
from .models import Report, Civic


class ReportSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField(read_only=True)
    photo = serializers.SerializerMethodField(read_only=True)
    coords = serializers.SerializerMethodField(read_only=True)
    voice_url = serializers.SerializerMethodField(read_only=True)

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
            "voice_url",
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
        # If it's an absolute URL but points to local-only hosts (emulator/localhost),
        # rewrite it to the current request host so mobile devices can reach it.
        if url.startswith("http://") or url.startswith("https://"):
            try:
                from urllib.parse import urlparse
                parts = urlparse(url)
                host = (parts.hostname or "").lower()
                # Hosts that are not reachable from a phone
                local_hosts = {"127.0.0.1", "localhost", "10.0.2.2", "0.0.0.0"}
                request = self.context.get("request") if hasattr(self, 'context') else None
                if request and host in local_hosts:
                    path = parts.path or "/"
                    if parts.query:
                        path = f"{path}?{parts.query}"
                    return request.build_absolute_uri(path)
            except Exception:
                pass
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
    
    def get_voice_url(self, obj: Report) -> str | None:
        # Return the voice URL if it exists
        try:
            if getattr(obj, 'voice', None) and obj.voice:
                return self._absolute_url(obj.voice.url)
        except Exception:
            pass
        return None

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


User = get_user_model()


class SignupSerializer(serializers.Serializer):
    # Basic auth user fields
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    # Civic profile extras
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    # Accept coordinates for PointField
    lat = serializers.FloatField(required=False)
    lng = serializers.FloatField(required=False)
    # Optional profile photo via multipart forms; for JSON, ignore
    avatar = serializers.ImageField(required=False, allow_null=True)

    def validate_username(self, value: str):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value

    def validate_email(self, value: str):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already in use")
        return value

    def validate(self, data):
        # Password checks
        pwd = data.get('password')
        cpwd = data.get('confirm_password')
        if pwd != cpwd:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        validate_password(pwd)
        return data

    def create(self, validated_data):
        # Extract civic fields
        phone = validated_data.pop("phone_number", "")
        lat = validated_data.pop("lat", None)
        lng = validated_data.pop("lng", None)
        avatar = validated_data.pop("avatar", None)

        password = validated_data.pop("password")
        # remove confirm_password from model fields
        validated_data.pop("confirm_password", None)
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        civic = Civic(user=user, phone_number=phone)
        if lat is not None and lng is not None:
            try:
                civic.location = Point(lng, lat, srid=4326)
            except Exception:
                pass
        if avatar is not None:
            civic.avatar = avatar
        civic.save()
        return user

    def to_representation(self, user):
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
