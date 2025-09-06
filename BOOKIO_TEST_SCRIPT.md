# REFRESH Studio Bookio Integration Test Plan

## PRODUCTION SYSTEM - HANDLE WITH CARE

### Authentication Details
- **Session Cookie**: `bses-0` (12-hour expiry)
- **Cookie Refresh**: Set-Cookie headers indicate automatic token rotation
- **Domain**: `services.bookio.com`

### API Endpoints
```
Base URL: https://services.bookio.com/client-admin/api
- /schedule/services - Get available services
- /schedule/slots - Get available time slots
- /bookings - Create new booking
```

### Facilities
1. **Bratislava**: REFRESH prevádzka BRATISLAVA (Created: 7/14/23)
2. **Pezinok**: REFRESH prevádzka PEZINOK (Created: 7/12/23)

### Test Period
**November 23-29, 2025** (chosen to avoid conflicts with current bookings)

### Test Bookings to Create

#### Test 1: Basic Hydrafacial Booking
```bash
# DO NOT RUN - FOR REVIEW ONLY
curl -X POST 'https://services.bookio.com/client-admin/api/bookings' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: bses-0=[SESSION_TOKEN]' \
  -d '{
    "service": "hydrafacial",
    "location": "bratislava",
    "date": "2025-11-23",
    "time": "10:00",
    "customer": {
      "name": "Test Zákazník 1",
      "phone": "+421900000001",
      "email": "test1@refresh.sk",
      "age": "25"
    }
  }'
```

#### Test 2: Laser Treatment with Worker Selection
```bash
# DO NOT RUN - FOR REVIEW ONLY
curl -X POST 'https://services.bookio.com/client-admin/api/bookings' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: bses-0=[SESSION_TOKEN]' \
  -d '{
    "service": "laserova epilacia",
    "location": "pezinok",
    "date": "2025-11-25",
    "time": "14:30",
    "worker": "Janka",
    "customer": {
      "name": "Test Zákazník 2",
      "phone": "+421900000002",
      "email": "test2@refresh.sk"
    }
  }'
```

### Token Refresh Implementation

```javascript
// Token refresh handler for production
class BookioSessionManager {
  constructor() {
    this.sessionCookie = null;
    this.cookieExpiry = null;
  }

  parseSetCookieHeader(setCookieHeader) {
    const match = setCookieHeader.match(/bses-0=([^;]+)/);
    if (match) {
      this.sessionCookie = match[1];
      // Parse Max-Age (43200 seconds = 12 hours)
      const maxAge = setCookieHeader.match(/Max-Age=(\d+)/);
      if (maxAge) {
        this.cookieExpiry = Date.now() + (parseInt(maxAge[1]) * 1000);
      }
    }
  }

  isTokenExpired() {
    return !this.sessionCookie || Date.now() >= this.cookieExpiry;
  }

  async refreshToken() {
    // Session refresh happens automatically via Set-Cookie headers
    // Monitor response headers for new bses-0 cookie
    console.log('Token refresh detected via Set-Cookie header');
  }
}
```

### Verification Steps

1. **Pre-flight Checks** (READ-ONLY):
   ```bash
   # Check current services
   curl -X POST 'https://services.bookio.com/client-admin/api/schedule/services' \
     -H 'Cookie: bses-0=[SESSION_TOKEN]' \
     -d '{"facilityId": "bratislava_facility_id"}'
   
   # Check available slots for November 23-29
   curl -X POST 'https://services.bookio.com/client-admin/api/schedule/slots' \
     -H 'Cookie: bses-0=[SESSION_TOKEN]' \
     -d '{"date": "2025-11-23", "serviceId": "[SERVICE_ID]"}'
   ```

2. **Test Booking Flow** (DRY RUN):
   - Log all API requests without executing
   - Verify request structure matches Bookio format
   - Check session cookie validity
   - Confirm date/time availability

3. **Production Safety Checklist**:
   - [ ] Session cookie extracted correctly
   - [ ] Test dates are in November 23-29 range
   - [ ] Test customer data clearly marked as test
   - [ ] Rollback plan prepared (booking cancellation API)
   - [ ] Admin panel access confirmed for manual verification

### Rollback Plan

```bash
# Cancel test booking if needed
curl -X DELETE 'https://services.bookio.com/client-admin/api/bookings/[BOOKING_ID]' \
  -H 'Cookie: bses-0=[SESSION_TOKEN]'
```

### Notes
- The `bses-0` cookie rotates every 12 hours (Max-Age=43200)
- Multiple `bses-` cookies (0-4) suggest load balancing or security rotation
- All requests require `X-Requested-With: XMLHttpRequest` header
- Content-Type must be `application/json`

## DO NOT EXECUTE WITHOUT EXPLICIT CONFIRMATION