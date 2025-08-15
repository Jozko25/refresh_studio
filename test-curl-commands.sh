#!/bin/bash

# Bookio Webhook API Test Commands
# Run these commands to test all API endpoints

echo "🧪 Testing Bookio Webhook API"
echo "==============================="
echo ""

# Base URL
API_BASE="http://localhost:3000"

echo "1. 🔍 Health Check"
echo "curl -X GET $API_BASE/health"
curl -X GET $API_BASE/health
echo -e "\n\n"

echo "2. 📋 Get Services"
echo "curl -X GET $API_BASE/api/booking/services"
curl -X GET $API_BASE/api/booking/services
echo -e "\n\n"

echo "3. 📅 Get Allowed Days"
echo "curl -X POST $API_BASE/api/booking/allowed-days \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"serviceId\": 130113, \"workerId\": 31576}'"
curl -X POST $API_BASE/api/booking/allowed-days \
  -H "Content-Type: application/json" \
  -d '{"serviceId": 130113, "workerId": 31576}'
echo -e "\n\n"

echo "4. ⏰ Get Allowed Times (Today)"
echo "curl -X POST $API_BASE/api/booking/allowed-times \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"serviceId\": 130113, \"workerId\": 31576, \"date\": \"15.08.2025 10:22\"}'"
curl -X POST $API_BASE/api/booking/allowed-times \
  -H "Content-Type: application/json" \
  -d '{"serviceId": 130113, "workerId": 31576, "date": "15.08.2025 10:22"}'
echo -e "\n\n"

echo "5. 🎯 Soonest Available Appointment"
echo "curl -X POST $API_BASE/api/booking/soonest-available \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"serviceId\": 130113, \"workerId\": 31576, \"daysToCheck\": 7}'"
curl -X POST $API_BASE/api/booking/soonest-available \
  -H "Content-Type: application/json" \
  -d '{"serviceId": 130113, "workerId": 31576, "daysToCheck": 7}'
echo -e "\n\n"

echo "6. 🚀 MAIN WEBHOOK - Soonest Available (Make.com Integration)"
echo "curl -X POST $API_BASE/api/booking/webhook/soonest-available \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"serviceId\": 130113, \"workerId\": 31576, \"daysToCheck\": 30, \"source\": \"make-com\"}'"
curl -X POST $API_BASE/api/booking/webhook/soonest-available \
  -H "Content-Type: application/json" \
  -d '{"serviceId": 130113, "workerId": 31576, "daysToCheck": 30, "source": "make-com"}'
echo -e "\n\n"

echo "7. 🔄 Get Next Available for All Services"
echo "curl -X GET \"$API_BASE/api/booking/next-available-all?days=7\""
curl -X GET "$API_BASE/api/booking/next-available-all?days=7"
echo -e "\n\n"

echo "8. 🗣️ ElevenLabs - Available Times (Slovak, max 3 times)"
echo "curl -X POST $API_BASE/api/booking/webhook/elevenlabs-available-times \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"date\": \"15.08.2025 10:22\", \"source\": \"elevenlabs\"}'"
curl -X POST $API_BASE/api/booking/webhook/elevenlabs-available-times \
  -H "Content-Type: application/json" \
  -d '{"date": "15.08.2025 10:22", "source": "elevenlabs"}'
echo -e "\n\n"

echo "9. 🗣️ ElevenLabs - Soonest Available (Slovak sentence)"
echo "curl -X POST $API_BASE/api/booking/webhook/elevenlabs-soonest-available \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"source\": \"elevenlabs\"}'"
curl -X POST $API_BASE/api/booking/webhook/elevenlabs-soonest-available \
  -H "Content-Type: application/json" \
  -d '{"source": "elevenlabs"}'
echo -e "\n\n"

echo "10. ✅ Check Time Slot Availability"
echo "curl -X POST $API_BASE/api/booking/check-availability \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"date\": \"15.08.2025 10:22\", \"time\": \"12:00\"}'"
curl -X POST $API_BASE/api/booking/check-availability \
  -H "Content-Type: application/json" \
  -d '{"date": "15.08.2025 10:22", "time": "12:00"}'
echo -e "\n\n"

echo "11. 📅 Book Appointment (Technical)"
echo "curl -X POST $API_BASE/api/booking/book-appointment \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"date\": \"15.08.2025 10:22\", \"time\": \"12:00\", \"customer\": {\"firstName\": \"Jan\", \"lastName\": \"Test\", \"email\": \"jan@test.com\", \"phone\": \"+421123456789\"}, \"source\": \"test\"}'"
echo "NOTE: This will attempt to book - may fail if endpoint doesn't exist yet"
curl -X POST $API_BASE/api/booking/book-appointment \
  -H "Content-Type: application/json" \
  -d '{"date": "15.08.2025 10:22", "time": "12:00", "customer": {"firstName": "Jan", "lastName": "Test", "email": "jan@test.com", "phone": "+421123456789"}, "source": "test"}'
echo -e "\n\n"

echo "12. 🗣️ ElevenLabs - Book Appointment (Slovak confirmation)"
echo "curl -X POST $API_BASE/api/booking/webhook/elevenlabs-book-appointment \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"date\": \"15.08.2025 10:22\", \"time\": \"12:15\", \"customer\": {\"firstName\": \"Mária\", \"lastName\": \"Novák\", \"email\": \"maria@test.sk\"}, \"source\": \"elevenlabs\"}'"
echo "NOTE: This will attempt to book - may fail if endpoint doesn't exist yet"
curl -X POST $API_BASE/api/booking/webhook/elevenlabs-book-appointment \
  -H "Content-Type: application/json" \
  -d '{"date": "15.08.2025 10:22", "time": "12:15", "customer": {"firstName": "Mária", "lastName": "Novák", "email": "maria@test.sk"}, "source": "elevenlabs"}'
echo -e "\n\n"

echo "✅ All tests completed!"
echo ""
echo "🎯 MAIN WEBHOOK ENDPOINTS:"
echo ""
echo "📊 Technical/Make.com Integration:"
echo "POST $API_BASE/api/booking/webhook/soonest-available"
echo ""
echo "🗣️ ElevenLabs/Voice Integration:"
echo "POST $API_BASE/api/booking/webhook/elevenlabs-soonest-available"
echo "POST $API_BASE/api/booking/webhook/elevenlabs-available-times"
echo "POST $API_BASE/api/booking/webhook/elevenlabs-book-appointment"
echo ""
echo "📅 Booking Endpoints:"
echo "POST $API_BASE/api/booking/book-appointment"
echo "POST $API_BASE/api/booking/check-availability"
echo ""
echo "📋 Required headers:"
echo "Content-Type: application/json"
echo ""
echo "📄 Request body examples:"
echo ""
echo "For ElevenLabs (Slovak response):"
echo '{'
echo '  "source": "elevenlabs"'
echo '}'
echo ""
echo "For technical integration:"
echo '{'
echo '  "serviceId": 130113,'
echo '  "workerId": 31576,'
echo '  "daysToCheck": 30,'
echo '  "source": "your-system-name"'
echo '}'
