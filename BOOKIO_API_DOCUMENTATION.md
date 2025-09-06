# REFRESH Studio - Bookio API Documentation

## ✅ CONFIRMED WORKING ENDPOINTS

### 1. **Schedule Options** - `/schedule/options`
```json
POST https://services.bookio.com/client-admin/api/schedule/options
{
  "params": {"_gl": "[tracking_params]"},
  "facility": "refresh-laserove-a-esteticke-studio-zu0yxr5l"
}
```
**Response**: Schedule settings, opening hours, time intervals

### 2. **Services** - `/schedule/services`
```json
POST https://services.bookio.com/client-admin/api/schedule/services
{
  "facility": "refresh-laserove-a-esteticke-studio-zu0yxr5l"
}
```
**Response**: 192 services with IDs, prices, durations, workers

### 3. **Resource Objects (Workers)** - `/schedule/res-objects`
```json
POST https://services.bookio.com/client-admin/api/schedule/res-objects
{
  "facility": "refresh-laserove-a-esteticke-studio-zu0yxr5l"
}
```
**Response**: 5 workers (Janka, Miško, Valika, Veronika, Zuzka)

### 4. **Calendar Data** - `/schedule/data`
```json
POST https://services.bookio.com/client-admin/api/schedule/data
{
  "from": "2025-11-23T00:00:00.000Z",
  "to": "2025-11-29T23:59:59.000Z",
  "facility": "refresh-laserove-a-esteticke-studio-zu0yxr5l"
}
```
**Response**: Calendar events and availability

## 🔑 KEY SERVICE IDs

- **Hydrafacial**: 63975 (145€, 60 min, Janka)
- **Laser**: 60230 (15€, 10 min, Janka)

## 👥 WORKER IDs

- Janka: `u_18204`
- Miško: `u_17782`
- Valika: `u_17785`
- Veronika: `u_30224`
- Zuzka: `u_25284`

## 🔐 AUTHENTICATION

- **Cookie**: `bses-0` (12-hour expiry, auto-refreshes)
- **Headers Required**:
  - `X-Requested-With: XMLHttpRequest`
  - `Content-Type: application/json`
  - `Origin: https://services.bookio.com`

## 📅 TEST PERIOD

**November 23-29, 2025** - Chosen to avoid conflicts

## ⚠️ MISSING: BOOKING CREATION ENDPOINT

We need the network request that occurs when:
1. User clicks on a calendar time slot
2. Fills in customer details
3. Confirms the booking

This will likely be:
- `POST /client-admin/api/bookings` or
- `POST /client-admin/api/schedule/bookings` or
- `POST /client-admin/api/reservations`

## 🚀 NEXT STEPS

1. **Get booking creation endpoint** - Click "Create Booking" in admin panel
2. **Test with November dates** - Use test customer data
3. **Implement token refresh** - Monitor Set-Cookie headers
4. **Create rollback mechanism** - Booking cancellation API

## 📝 NOTES

- All endpoints return 200 status on success
- Session token refreshes automatically via Set-Cookie
- Facility slug is constant for all requests
- Calendar data uses ISO 8601 date format with timezone