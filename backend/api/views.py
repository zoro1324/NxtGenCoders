from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from .models import Report
from .serializers import ReportSerializer


@api_view(["GET", "POST"])
def reports_list(request):
	"""List reports with pagination or create a new report."""
	if request.method == "GET":
		qs = Report.objects.all()
		paginator = PageNumberPagination()
		page = paginator.paginate_queryset(qs, request)
		serializer = ReportSerializer(page, many=True)
		return paginator.get_paginated_response(serializer.data)

	# POST
	serializer = ReportSerializer(data=request.data)
	if serializer.is_valid():
		serializer.save()
		return Response(serializer.data, status=status.HTTP_201_CREATED)
	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def report_detail(request, pk: int):
	"""Retrieve, update, or delete a single report."""
	report = get_object_or_404(Report, pk=pk)
	if request.method == "GET":
		serializer = ReportSerializer(report)
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
