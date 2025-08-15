# Quick Test Commands for Bookio Webhook API

## 🚀 Main Webhook Endpoint (For Make.com/Zapier)

```bash
curl -X POST http://localhost:3000/api/booking/webhook/soonest-available \
  -H "Content-Type: application/json" \
  -d '{"source": "make-com"}'
```

**Response format:**
```json
{
  "success": true,
  "message": "Soonest available appointment found",
  "appointment": {
    "date": "15.08.2025 10:00",
    "day": 15,
    "month": 8, 
    "year": 2025,
    "firstAvailableTime": {
      "id": "11:45",
      "name": "11:45 AM",
      "nameSuffix": "11:55 AM"
    },
    "allAvailableTimes": [...],
    "serviceId": 130113,
    "workerId": 31576
  }
}
```

## 🔍 Individual API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Get Services
```bash
curl http://localhost:3000/api/booking/services
```

### Get Available Times for Specific Date
```bash
curl -X POST http://localhost:3000/api/booking/allowed-times \
  -H "Content-Type: application/json" \
  -d '{"date": "15.08.2025 10:22"}'
```

### Get Allowed Days
```bash
curl -X POST http://localhost:3000/api/booking/allowed-days \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Soonest Available (Alternative endpoint)
```bash
curl -X POST http://localhost:3000/api/booking/soonest-available \
  -H "Content-Type: application/json" \
  -d '{"daysToCheck": 7}'
```

## 🎯 Webhook Parameters

All parameters are optional with these defaults:
- `serviceId`: 130113 (your service)
- `workerId`: 31576 (your worker)
- `daysToCheck`: 30 (days to search)
- `source`: "webhook" (for tracking)

## 🧪 Test the Script

Make the test script executable and run it:
```bash
chmod +x test-curl-commands.sh
./test-curl-commands.sh
```

## 🔗 Integration URLs

**Local Development:**
- Main Webhook: `http://localhost:3000/api/booking/webhook/soonest-available`
- Health Check: `http://localhost:3000/health`

**Production:** 
Replace `localhost:3000` with your deployed domain.

## 📊 Expected Response Times
- Health Check: ~5ms
- Get Times: ~50-100ms  
- Webhook: ~100-200ms (depending on days to check)

## 🚨 Error Responses

**No appointments found:**
```json
{
  "success": false,
  "message": "No available appointments found",
  "error": "No available appointments found in the next X days checked"
}
```

**Server error:**
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details..."
}
```
