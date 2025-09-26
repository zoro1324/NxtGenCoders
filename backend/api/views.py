from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.contrib.gis.geos import Point
import json
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework.authtoken.models import Token
from .models import Report, Civic
from .serializers import ReportSerializer, SignupSerializer


@api_view(["GET"])
def health(request):
	"""Lightweight health check for connectivity tests."""
	return Response({"status": "ok"})


@api_view(["GET", "POST"])
def reports_list(request):
	"""List reports with pagination or create a new report."""
	if request.method == "GET":
		qs = Report.objects.all()
		paginator = PageNumberPagination()
		page = paginator.paginate_queryset(qs, request)
		serializer = ReportSerializer(page, many=True, context={"request": request})
		return paginator.get_paginated_response(serializer.data)

	# POST (accept both JSON and multipart)
	data = request.data.copy()
	files = {}
	# collect optional files
	if hasattr(request, 'FILES'):
		if request.FILES.get('image'):
			files['image'] = request.FILES['image']
		if request.FILES.get('voice'):
			files['voice'] = request.FILES['voice']

	# enforce: must have either text body or voice file
	body_text = (data.get('body') or '').strip()
	has_voice = bool(files.get('voice'))
	if not body_text and not has_voice:
		return Response({"detail": "Provide a description or attach a voice message."}, status=status.HTTP_400_BAD_REQUEST)

	serializer = ReportSerializer(data=data)
	if serializer.is_valid():
		instance = Report(**{k: v for k, v in serializer.validated_data.items() if k not in ('image', 'voice')})
		# Parse coordinates from request data and set Point (lng, lat)
		def _first_num(keys):
			for key in keys:
				val = request.data.get(key)
				if val is None:
					continue
				try:
					return float(val)
				except Exception:
					continue
			return None
		lat = _first_num(["coords_lat", "lat", "latitude"])
		lng = _first_num(["coords_lng", "lng", "longitude", "lon"])
		if lat is None or lng is None:
			# Try nested JSON 'coords'
			raw = request.data.get("coords")
			if raw:
				try:
					obj = raw if isinstance(raw, dict) else json.loads(raw)
					lat = float(obj.get("lat")) if obj.get("lat") is not None else lat
					lng = float(obj.get("lng")) if obj.get("lng") is not None else lng
				except Exception:
					pass
		if lat is not None and lng is not None:
			try:
				instance.coords = Point(lng, lat, srid=4326)
			except Exception:
				pass
		instance.save()
		updated = False
		if files.get('image'):
			instance.image = files['image']
			updated = True
		if files.get('voice'):
			instance.voice = files['voice']
			updated = True
		if updated:
			instance.save()
		out = ReportSerializer(instance, context={"request": request})
		return Response(out.data, status=status.HTTP_201_CREATED)
	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def report_detail(request, pk: int):
	"""Retrieve, update, or delete a single report."""
	report = get_object_or_404(Report, pk=pk)
	if request.method == "GET":
		serializer = ReportSerializer(report, context={"request": request})
		return Response(serializer.data)

	if request.method == "DELETE":
		report.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

	# PUT or PATCH
	partial = request.method == "PATCH"
	serializer = ReportSerializer(report, data=request.data, partial=partial)
	if serializer.is_valid():
		report = serializer.save()
		# handle optional file updates
		if hasattr(request, 'FILES'):
			updated = False
			if request.FILES.get('image'):
				report.image = request.FILES['image']
				updated = True
			if request.FILES.get('voice'):
				report.voice = request.FILES['voice']
				updated = True
			if updated:
				report.save()
		return Response(serializer.data)
	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@csrf_exempt
def seed_reports(request):
	"""Create a few demo reports for quick testing."""
	if request.method != "POST":
		return JsonResponse({"detail": "Method not allowed"}, status=405)
	if Report.objects.exists():
		return JsonResponse({"detail": "Already seeded"})
	Report.objects.create(
		name="Alex Chen",
		title="Pothole on Main Street, near City Hall",
		body="A large and dangerous pothole has developed on Main Street...",
		image_url="https://images.unsplash.com/photo-1519682337058-a94d519337bc?q=80&w=1600&auto=format&fit=crop",
		comments=5,
		likes=28,
		shares=3,
	)
	Report.objects.create(
		name="Maria Rodriguez",
		title="Broken street light on Oak Avenue",
		body="The street light on Oak Avenue has been out for three nights...",
		image_url="https://images.unsplash.com/photo-1603052875138-981d558d4f25?q=80&w=1600&auto=format&fit=crop",
		comments=5,
		likes=15,
		shares=1,
	)
	return JsonResponse({"detail": "Seeded"})


@api_view(["POST"])
def signup(request):
	"""Create a Django auth user and a linked Civic profile."""
	# Works with JSON or multipart (for avatar)
	serializer = SignupSerializer(data=request.data)
	if serializer.is_valid():
		user = serializer.save()
		# issue token for simple client auth
		token, _ = Token.objects.get_or_create(user=user)
		# build avatar URL if present
		avatar_url = None
		try:
			if hasattr(user, 'civic') and user.civic.avatar:
				request = getattr(serializer, 'context', {}).get('request', request)
				url = user.civic.avatar.url
				avatar_url = request.build_absolute_uri(url) if request else url
		except Exception:
			pass
		payload = serializer.to_representation(user) | {"token": token.key, "avatar": avatar_url}
		return Response(payload, status=status.HTTP_201_CREATED)
	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def login(request):
	"""Authenticate by username OR email + password.
	Request JSON: { "username": "user-or-email", "password": "..." }
	"""
	identifier = (request.data.get("username") or request.data.get("email") or "").strip()
	password = (request.data.get("password") or "").strip()
	if not identifier or not password:
		return Response({"detail": "Username/email and password required"}, status=status.HTTP_400_BAD_REQUEST)

	# Resolve username if an email was provided (or case-insensitive username)
	User = get_user_model()
	cand = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
	resolved_username = cand.username if cand else identifier
	user = authenticate(request, username=resolved_username, password=password)
	if not user:
		return Response({"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)
	token, _ = Token.objects.get_or_create(user=user)
	avatar = None
	try:
		if hasattr(user, 'civic') and user.civic.avatar:
			url = user.civic.avatar.url
			avatar = request.build_absolute_uri(url)
	except Exception:
		pass
	return Response({
		"id": user.id,
		"username": user.username,
		"email": user.email,
		"first_name": user.first_name,
		"last_name": user.last_name,
		"token": token.key,
		"avatar": avatar,
	})


@api_view(["GET"])
def me(request):
	# Token auth expected in Authorization: Token <key>
	if not request.user or not request.user.is_authenticated:
		return Response({"detail": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
	user = request.user
	avatar = None
	try:
		if hasattr(user, 'civic') and user.civic.avatar:
			avatar = request.build_absolute_uri(user.civic.avatar.url)
	except Exception:
		pass
	return Response({
		"id": user.id,
		"username": user.username,
		"email": user.email,
		"first_name": user.first_name,
		"last_name": user.last_name,
		"avatar": avatar,
	})
