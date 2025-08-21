#!/bin/bash

# REFRESH Clinic API Test Script
# Tests all endpoints for the comprehensive service scraping system

echo "🏥 REFRESH Clinic API Test Suite"
echo "================================"
echo ""

# Base URL
API_BASE="http://localhost:3000"

echo "🔍 Starting REFRESH Clinic API Tests"
echo ""

echo "1. 🏥 Get Facility Information"
echo "curl -X GET $API_BASE/api/refresh-clinic/facility"
curl -X GET $API_BASE/api/refresh-clinic/facility | jq '.'
echo -e "\n\n"

echo "2. 📋 Get All Services"
echo "curl -X GET $API_BASE/api/refresh-clinic/services"
curl -X GET $API_BASE/api/refresh-clinic/services | jq '.'
echo -e "\n\n"

echo "3. 📊 Get Service Categories"
echo "curl -X GET $API_BASE/api/refresh-clinic/service-categories"
curl -X GET $API_BASE/api/refresh-clinic/service-categories | jq '.'
echo -e "\n\n"

echo "4. 💰 Get Price List"
echo "curl -X GET $API_BASE/api/refresh-clinic/price-list"
curl -X GET $API_BASE/api/refresh-clinic/price-list | jq '.'
echo -e "\n\n"

echo "5. 🔍 Search Services (Facial treatments)"
echo "curl -X GET \"$API_BASE/api/refresh-clinic/services/search?q=pleťové\""
curl -X GET "$API_BASE/api/refresh-clinic/services/search?q=pleťové" | jq '.'
echo -e "\n\n"

echo "6. 📅 Get Services by Category (facial-treatments)"
echo "curl -X GET $API_BASE/api/refresh-clinic/services/category/facial-treatments"
curl -X GET $API_BASE/api/refresh-clinic/services/category/facial-treatments | jq '.'
echo -e "\n\n"

echo "7. ⏰ Get Service Availability (Service ID: 1003)"
echo "curl -X GET $API_BASE/api/refresh-clinic/services/1003/availability"
curl -X GET $API_BASE/api/refresh-clinic/services/1003/availability | jq '.'
echo -e "\n\n"

echo "8. 📋 Get All Services with Availability"
echo "curl -X GET $API_BASE/api/refresh-clinic/services-with-availability"
echo "Note: This may take a while as it checks availability for all services..."
curl -X GET $API_BASE/api/refresh-clinic/services-with-availability | jq '.services | length'
echo -e "\n\n"

echo "9. 🎯 Batch Availability Check (Multiple services)"
echo "curl -X POST $API_BASE/api/refresh-clinic/services/batch-availability \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"serviceIds\": [1001, 1003, 1008]}'"
curl -X POST $API_BASE/api/refresh-clinic/services/batch-availability \
  -H "Content-Type: application/json" \
  -d '{"serviceIds": [1001, 1003, 1008]}' | jq '.'
echo -e "\n\n"

echo "10. 🔍 Search with Availability (Hydrafacial)"
echo "curl -X GET \"$API_BASE/api/refresh-clinic/services/search?q=hydrafacial&availability=true\""
curl -X GET "$API_BASE/api/refresh-clinic/services/search?q=hydrafacial&availability=true" | jq '.'
echo -e "\n\n"

echo "✅ All REFRESH Clinic API tests completed!"
echo ""
echo "🎯 Key REFRESH Clinic Endpoints:"
echo ""
echo "📋 Services Management:"
echo "GET  $API_BASE/api/refresh-clinic/services"
echo "GET  $API_BASE/api/refresh-clinic/services/search?q=TERM"
echo "GET  $API_BASE/api/refresh-clinic/services/category/CATEGORY"
echo "GET  $API_BASE/api/refresh-clinic/price-list"
echo ""
echo "⏰ Availability Checking:"
echo "GET  $API_BASE/api/refresh-clinic/services/SERVICE_ID/availability"
echo "GET  $API_BASE/api/refresh-clinic/services-with-availability"
echo "POST $API_BASE/api/refresh-clinic/services/batch-availability"
echo ""
echo "🏥 Facility Information:"
echo "GET  $API_BASE/api/refresh-clinic/facility"
echo "GET  $API_BASE/api/refresh-clinic/service-categories"
echo ""
echo "📊 Available Service Categories:"
echo "- special-offers (AKCIA LETO 2025)"
echo "- acne-treatment (OŠETRENIE AKNÉ)"
echo "- facial-treatments (PLEŤOVÉ OŠETRENIA)"
echo "- laser-epilation (LASEROVÁ EPILÁCIA)"
echo "- hydrafacial (HYDRAFACIAL™)"
echo "- chemical-peeling (CHEMICKÝ PEELING)"
echo "- fibroma-removal (ODSTRÁNENIE FIBRÓMOV)"
echo "- eyebrow-tattooing (TETOVANIE OBOČIA)"
echo "- lips-treatment (PERY)"
echo "- piercing (PIERCING)"
echo "- consultations (KONZULTÁCIE)"
echo "- and more..."
echo ""
echo "🎨 Example Service IDs:"
echo "- 1001: AKCIA LETO 2025"
echo "- 1002: OŠETRENIE AKNÉ - DO 20 ROKOV"
echo "- 1003: PLEŤOVÉ OŠETRENIA - DO 30 ROKOV"
echo "- 1007: LASEROVÁ EPILÁCIA"
echo "- 1008: HYDRAFACIAL™"
echo "- 1018: TETOVANIE OBOČIA"