# Bookio Webhook API

A Node.js API server that interfaces with the Bookio booking system to provide webhook endpoints for retrieving appointment availability and booking information.

## Features

- 🔗 **Service Integration**: Get all available services from your Bookio facility
- 📅 **Date Availability**: Check which days are available for bookings
- ⏰ **Time Slots**: Retrieve available time slots for specific dates
- 🚀 **Soonest Available**: Find the next available appointment across all services
- 🔄 **Webhook Support**: Ready-to-use webhook endpoints for external integrations
- 🛡️ **Security**: Rate limiting, CORS, and security headers included
- 📊 **Monitoring**: Comprehensive logging and error handling

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Bookio Configuration
BOOKIO_FACILITY_ID=ai-recepcia-zll65ixf
BOOKIO_BASE_URL=https://services.bookio.com

# Server Configuration
PORT=3000
NODE_ENV=development

# API Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will be available at `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and configuration.

### Services
```
GET /api/booking/services
```
Get all available services with their details (ID, name, duration, price).

### Available Days
```
POST /api/booking/allowed-days
Content-Type: application/json

{
  "serviceId": 128019,
  "workerId": -1,
  "count": 1,
  "participantsCount": 0,
  "addons": []
}
```
Get allowed booking days for a specific service.

### Available Times
```
POST /api/booking/allowed-times
Content-Type: application/json

{
  "serviceId": 128019,
  "date": "15.08.2025 10:03",
  "workerId": -1,
  "count": 1,
  "participantsCount": 0,
  "addons": []
}
```
Get available time slots for a specific service and date.

### Soonest Available Appointment
```
POST /api/booking/soonest-available
Content-Type: application/json

{
  "serviceId": 128019,
  "daysToCheck": 30
}
```
Find the next available appointment slot.

### Next Available (All Services)
```
GET /api/booking/next-available-all?days=7
```
Get next available appointments for all services.

## Webhook Endpoints

### Soonest Available Webhook
```
POST /api/booking/webhook/soonest-available
Content-Type: application/json

{
  "serviceId": 128019,
  "daysToCheck": 30,
  "source": "your-system-name"
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "Soonest available appointment found",
  "appointment": {
    "date": "15.08.2025 10:03",
    "firstAvailableTime": "11:30",
    "allAvailableTimes": ["11:30", "11:45", "12:00", "12:15"],
    "serviceId": 128019
  },
  "timestamp": "2025-08-15T10:03:14.000Z",
  "source": "your-system-name"
}
```

## Usage Examples

### cURL Examples

**Get services:**
```bash
curl -X GET http://localhost:3000/api/booking/services
```

**Find soonest available appointment:**
```bash
curl -X POST http://localhost:3000/api/booking/webhook/soonest-available \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": 128019,
    "daysToCheck": 30,
    "source": "make-com"
  }'
```

### Integration with Make.com

1. Create a new scenario in Make.com
2. Add a "Webhooks" -> "Custom webhook" module
3. Set the webhook URL to: `https://your-domain.com/api/booking/webhook/soonest-available`
4. Configure the request body with your desired parameters
5. Process the response data in subsequent modules

### Integration with Zapier

1. Create a new Zap
2. Choose "Webhooks by Zapier" as the trigger app
3. Select "POST" as the method
4. Set the webhook URL and configure the payload
5. Test the webhook and use the appointment data in your workflow

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details",
  "timestamp": "2025-08-15T10:03:14.000Z"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing parameters)
- `404` - Not Found (no appointments available)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

Default rate limits:
- **100 requests per 15 minutes** per IP address
- Configurable via environment variables

## Development

### Project Structure
```
src/
├── server.js              # Main server file
├── routes/
│   └── booking.js         # API routes
├── services/
│   └── bookioService.js   # Bookio API integration
└── middleware/
    └── errorHandler.js    # Error handling middleware
```

### Testing

This project includes comprehensive test coverage with multiple test suites:

#### Test Structure
```
tests/
├── services/           # Unit tests for service classes
├── routes/            # Integration tests for API endpoints  
├── middleware/        # Middleware functionality tests
├── integration/       # Full application integration tests
├── edge-cases/        # Edge cases and error handling tests
├── fixtures/          # Test data and mock responses
└── setup.js          # Test configuration
```

#### Running Tests
```bash
# Run all tests
npm test

# Run with coverage report  
npm run test:coverage

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # API endpoint tests
npm run test:edge          # Edge cases and error handling

# Watch mode for development
npm run test:watch

# CI mode (coverage required)
npm run test:ci

# Manual API testing
chmod +x test-curl-commands.sh
./test-curl-commands.sh
```

#### Test Coverage
- **Branches**: 80% minimum
- **Functions**: 80% minimum  
- **Lines**: 80% minimum
- **Statements**: 80% minimum

#### Key Test Features
- ✅ **Comprehensive Mocking** - External API calls mocked
- ✅ **Edge Case Coverage** - Invalid inputs, errors, timeouts
- ✅ **Slovak Language** - ElevenLabs webhook Slovak responses
- ✅ **Concurrent Testing** - Race condition simulation
- ✅ **Error Boundaries** - Graceful failure handling
- ✅ **Security Testing** - Input validation, XSS prevention

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
