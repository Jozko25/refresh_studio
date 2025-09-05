# REFRESH Clinic Voice Assistant - Testing Commands

## Test Real Slot Availability 

### 1. Test PERK EYE Service Search (No age question)
```bash
curl -X POST "https://refreshstudio-production.up.railway.app/api/elevenlabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "refresh_booking",
    "service": "perk eye",
    "location": "pezinok"
  }'
```

### 2. Test Age-Specific Service (Asks for age)
```bash
curl -X POST "https://refreshstudio-production.up.railway.app/api/elevenlabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "refresh_booking",
    "service": "akné ošetrenie",
    "location": "bratislava"
  }'
```

### 3. Test Specific Time Request
```bash
curl -X POST "https://refreshstudio-production.up.railway.app/api/elevenlabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "refresh_booking",
    "service": "perk eye 14:00",
    "location": "pezinok"
  }'
```

### 4. Test With Age Provided
```bash
curl -X POST "https://refreshstudio-production.up.railway.app/api/elevenlabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "refresh_booking",
    "service": "pleťové ošetrenie",
    "location": "bratislava",
    "age": "17"
  }'
```

### 5. Test Services Overview
```bash
curl -X POST "https://refreshstudio-production.up.railway.app/api/elevenlabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_services_overview"
  }'
```

### 6. Test Full Booking Flow (Final Step)
```bash
curl -X POST "https://refreshstudio-production.up.railway.app/api/elevenlabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "refresh_booking",
    "service": "perk eye",
    "location": "pezinok",
    "name": "Peter Novák",
    "phone": "+421905123456",
    "email": "peter@email.sk"
  }'
```

## Expected Responses

### Service Found - No Age Question
```
HYDRAFACIAL™ PERK EYE
📍 Pezinok
💰 60.00 €
⏱️ 30min.

Pre rezerváciu a overenie dostupných termínov pokračujte cez náš rezervačný systém.
Chcete pokračovať s rezerváciou?
```

### Service Found - Asks Age
```
Pre akné ošetrenie máme rôzne možnosti podľa veku. Koľko máte rokov?

Toto nám pomôže vybrať najvhodnejšie ošetrenie pre vás.
```

### Time-Specific Request
```
Prepáčte, 14:00 nie je dostupné.
📋 HYDRAFACIAL™ PERK EYE
💰 60.00 €

Najbližší dostupný termín je 08.09.2025 o 10:45.
```

### Booking Confirmation
```
Perfektné! Vaša rezervácia bola zaznamenaná.
📋 HYDRAFACIAL™ PERK EYE
📅 08.09.2025 o 10:45
📍 Pezinok

Náš tím vás bude kontaktovať pre potvردenie termínu.
```

## System Status Check

### Health Check
```bash
curl -s "https://refreshstudio-production.up.railway.app/health"
```

### Services Count Check
```bash
curl -s "https://refreshstudio-production.up.railway.app/api/auth/services-all-facilities" | jq '.services | length'
```

## Production URL
```
https://refreshstudio-production.up.railway.app/api/elevenlabs
```

## Current System Features
- ✅ 339 services across Bratislava & Pezinok
- ✅ Smart age-asking (only when needed)
- ✅ OpenAI-powered service matching
- ✅ Real-time Bookio slot availability
- ✅ Multi-facility support
- ✅ Time-specific availability checking
- ✅ Booking confirmation with Zapier webhook