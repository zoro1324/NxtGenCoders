from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.contrib.gis.geos import Point
import json
from .models import Report
from .serializers import ReportSerializer


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
	# If a file field named 'image' exists in multipart, pass it
	if hasattr(request, 'FILES') and request.FILES.get('image'):
		files['image'] = request.FILES['image']
	serializer = ReportSerializer(data=data)
	if serializer.is_valid():
		instance = Report(**{k: v for k, v in serializer.validated_data.items() if k != 'image'})
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
		if files.get('image'):
			instance.image = files['image']
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
		serializer.save()
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
