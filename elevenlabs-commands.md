# ElevenLabs Compatible Endpoints - Slovak Language

## 🗣️ **Ready for Voice Integration**

These endpoints return clean Slovak language sentences perfect for ElevenLabs TTS.

### 1. **Available Times for Specific Date** (Max 3 slots)

```bash
curl -X POST http://localhost:3000/api/booking/webhook/elevenlabs-available-times \
  -H "Content-Type: application/json" \
  -d '{"date": "15.08.2025 10:22", "source": "elevenlabs"}'
```

**Example Response:**
```json
{
  "response": "Dostupné sú termíny o 12:00 v poludnie, 12:15 v poludnie a 12:30 v poludnie.",
  "success": true,
  "availableTimes": [
    {"time": "12:00", "display": "12:00 PM"},
    {"time": "12:15", "display": "12:15 PM"},
    {"time": "12:30", "display": "12:30 PM"}
  ]
}
```

**Voice Output:** *"Dostupné sú termíny o 12:00 v poludnie, 12:15 v poludnie a 12:30 v poludnie."*

---

### 2. **Soonest Available Appointment**

```bash
curl -X POST http://localhost:3000/api/booking/webhook/elevenlabs-soonest-available \
  -H "Content-Type: application/json" \
  -d '{"source": "elevenlabs"}'
```

**Example Response:**
```json
{
  "response": "Najbližší dostupný termín je v piatok 15. august o 12:00 v poludnie.",
  "success": true,
  "appointment": {
    "date": "15. august 2025",
    "time": "12:00 v poludnie",
    "dayName": "piatok"
  }
}
```

**Voice Output:** *"Najbližší dostupný termín je v piatok 15. august o 12:00 v poludnie."*

---

### 3. **Available Times Without Specific Date** (Next 3 available)

```bash
curl -X POST http://localhost:3000/api/booking/webhook/elevenlabs-available-times \
  -H "Content-Type: application/json" \
  -d '{"source": "elevenlabs"}'
```

This will find the soonest available day and return the first 3 time slots.

---

## 🔧 **Parameters**

All parameters are optional:

- `date`: Specific date in format "DD.MM.YYYY HH:mm" (if not provided, uses soonest available)
- `maxTimes`: Maximum number of times to return (default: 3)
- `source`: Tracking identifier (recommended: "elevenlabs")

## 🗣️ **Slovak Time Formatting**

The API automatically converts times to natural Slovak:

- `12:00` → "12:00 v poludnie"
- `09:30` → "9:30 dopoludnia"  
- `14:15` → "2:15 poobede"
- `00:00` → "12:00 o polnoci"

## 📅 **Slovak Date Formatting**

Dates include full Slovak names:

- **Days:** pondelok, utorok, streda, štvrtok, piatok, sobota, nedeľa
- **Months:** január, február, marec, apríl, máj, jún, júl, august, september, október, november, december

## ❌ **Error Responses**

**No times available:**
```json
{
  "response": "Ľutujem, ale na požadovaný dátum nie sú dostupné žiadne termíny.",
  "success": false
}
```

**Technical error:**
```json
{
  "response": "Ľutujem, vyskytla sa technická chyba. Skúste to prosím neskôr.",
  "success": false
}
```

## 🚀 **Production Usage**

Replace `localhost:3000` with your production domain:

```
https://your-domain.com/api/booking/webhook/elevenlabs-soonest-available
https://your-domain.com/api/booking/webhook/elevenlabs-available-times
```

## 🎯 **Integration with ElevenLabs/Make.com**

1. Use these endpoints in your Make.com scenario
2. Extract the `response` field for TTS
3. The response is a clean Slovak sentence ready for voice synthesis
4. Maximum 3 time slots to avoid overwhelming the user
