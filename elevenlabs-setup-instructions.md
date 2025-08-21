# ElevenLabs Setup Instructions for REFRESH Clinic

## 1. Agent Configuration

### Prompt:
```
Ste asistentka pre REFRESH laserové a estetické štúdio v Bratislave na Lazaretskej 13. Vaša úloha je pomáhať klientom rezervovať si termíny na služby.

VAŠE SCHOPNOSTI:
- Môžete vyhľadať služby podľa názvu
- Môžete nájsť najrýchlejší dostupný termín
- Môžete skontrolovať konkrétny dátum a čas
- Môžete poskytnúť informácie o cenách a trvaniach
- Môžete ukázať dostupné časy pre rôznych pracovníkov

NAJOBĽÚBENEJŠIE SLUŽBY:
- HYDRAFACIAL (od 65€ - 145€)
- Pleťové ošetrenia (od 40€)
- Laserová epilácia (od 24€)
- Chemický peeling (od 62€)
- Mezoterapia (130€-200€)
- Laminácia obočia (40€)
- Piercing a konzultácie

OTVÁRACIE HODINY:
Pondelok-Piatok: 9:00-12:00, 13:00-17:00
Víkend: Zatvorené

INŠTRUKCIE PRE ROZHOVOR:
1. Buďte priateľská, ale profesionálna
2. Hovorte po slovensky
3. Keď klient pýta "Aké služby ponúkate?", použite get_services_overview
4. Keď klient spomenie konkrétnu službu, použite search_service
5. Keď klient chce rezervovať, použite get_booking_info alebo find_soonest_slot
6. Vždy poskytnite alternatívy ak požadovaný čas nie je dostupný
7. Spýtajte sa na preferovaného pracovníka (Janka, Veronika, alebo nezáleží)

PRÍKLAD ROZHOVORU:
Klient: "Dobrý deň, aké služby ponúkate?"
Vy: "Dobrý deň! Ponúkame široký výber služieb. Naše najobľúbenejšie sú Hydrafacial, pleťové ošetrenia a laserová epilácia. Chcete počuť viac o konkrétnej službe?"

Klient: "Zaujíma ma hydrafacial"
Vy: [použite search_service s "hydrafacial"]

Klient: "Kedy máte najrýchlejší termín?"
Vy: [použite find_soonest_slot]

PAMÄTAJTE:
- Vždy potvrďte detaily pred rezerváciou
- Poskytnite alternatívne časy ak je to potrebné
- Buďte nápomocná pri výbere vhodnej služby
- Spomeňte cenu a trvanie služby
```

### First Message:
```
Dobrý deň! Volám z REFRESH laserového a estetického štúdia. Ako vám môžem pomôcť s rezerváciou termínu?
```

### Language: 
```
sk
```

## 2. Tool Configuration

### Webhook Base URL:
```
http://YOUR_SERVER_URL:3000/api/elevenlabs
```

### Tools to Add:

#### 1. get_services_overview
- **Function Name:** `get_services_overview`
- **Description:** `Get initial overview of most popular services when client asks 'what services do you offer'`
- **URL:** `POST /get_services_overview`
- **Parameters:** None

#### 2. search_service
- **Function Name:** `search_service`
- **Description:** `Search for specific services by name or keyword`
- **URL:** `POST /search_service`
- **Parameters:**
  - `search_term` (string, required): Service name or keyword

#### 3. find_soonest_slot
- **Function Name:** `find_soonest_slot`
- **Description:** `Find the earliest available appointment slot for a service`
- **URL:** `POST /find_soonest_slot`
- **Parameters:**
  - `service_id` (string, required): Service ID from previous search
  - `worker_id` (string, optional): Worker ID (-1 for any, 18204 for Janka, 30224 for Veronika)

#### 4. check_specific_slot
- **Function Name:** `check_specific_slot`
- **Description:** `Check if a specific date and time is available`
- **URL:** `POST /check_specific_slot`
- **Parameters:**
  - `service_id` (string, required): Service ID
  - `worker_id` (string, optional): Worker ID
  - `date` (string, required): Date in YYYY-MM-DD format
  - `time` (string, required): Time in HH:MM format

#### 5. get_booking_info
- **Function Name:** `get_booking_info`
- **Description:** `Get complete booking information for a service`
- **URL:** `POST /get_booking_info`
- **Parameters:**
  - `service_id` (string, required): Service ID
  - `worker_id` (string, optional): Worker ID

#### 6. quick_service_lookup
- **Function Name:** `quick_service_lookup`
- **Description:** `Quick lookup of service with availability`
- **URL:** `POST /quick_service_lookup`
- **Parameters:**
  - `search_term` (string, required): Service name
  - `date` (string, optional): Date in DD.MM.YYYY format

#### 7. get_opening_hours
- **Function Name:** `get_opening_hours`
- **Description:** `Get studio opening hours and location`
- **URL:** `POST /get_opening_hours`
- **Parameters:** None

## 3. Server Setup

1. Make sure your server is running:
   ```bash
   node src/server.js
   ```

2. Your server should show:
   ```
   🤖 ElevenLabs: http://localhost:3000/api/elevenlabs/[tool_name]
   ```

3. If using external server, replace `localhost:3000` with your domain.

## 4. Test Commands

Test the tools manually:

```bash
# Test service overview
curl -X POST http://localhost:3000/api/elevenlabs/get_services_overview

# Test service search
curl -X POST http://localhost:3000/api/elevenlabs/search_service \
  -H "Content-Type: application/json" \
  -d '{"search_term": "hydrafacial"}'

# Test soonest slot
curl -X POST http://localhost:3000/api/elevenlabs/find_soonest_slot \
  -H "Content-Type: application/json" \
  -d '{"service_id": "127325"}'
```

## 5. Common Issues

- **Tools not working:** Check webhook URL is accessible
- **No response:** Verify server is running and endpoints exist
- **Slovak encoding:** Make sure ElevenLabs supports Slovak language
- **Service IDs:** Get actual service IDs from search results first

## 6. Sample Conversation Flow

1. **Client:** "Dobrý deň, aké služby ponúkate?"
   - **Tool:** `get_services_overview`
   - **Response:** Lists top 3 services

2. **Client:** "Zaujíma ma hydrafacial"
   - **Tool:** `search_service` with `{"search_term": "hydrafacial"}`
   - **Response:** Shows hydrafacial options with prices

3. **Client:** "Kedy máte najrýchlejší termín?"
   - **Tool:** `find_soonest_slot` with service_id from previous search
   - **Response:** Shows earliest available time

4. **Client:** "Môžem dnes o 14:30?"
   - **Tool:** `check_specific_slot` with date and time
   - **Response:** Confirms availability or suggests alternatives

Ready to use! 🎉