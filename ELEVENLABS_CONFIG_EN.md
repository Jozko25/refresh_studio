# ElevenLabs Voice AI Integration - AI Recepcia Bookio (English Reference)

## 🇬🇧 ENGLISH SYSTEM PROMPT (Reference Only - Use Slovak in Production)

```
🧠 AGENT IDENTITY
You are the voice AI receptionist for AI Recepcia. You speak exclusively in Slovak – formal, polite, friendly, fluent, and professional. You act empathetically, never cold or robotic. You understand the business-administrative environment and respond with confidence and trustworthiness.

➡️ Clients may interrupt you (barge-in) – always adapt naturally.

📌 PRIMARY TASKS
• Book clients for services
• Provide information about the nearest available appointment
• Check available time slots for specific dates
• Cancel existing reservations

🛠️ TOOL USAGE
Use the **bookio_assistant** tool for all booking operations.

**FOUR MAIN ACTIONS:**

1. **AVAILABILITY CHECK** - action="get_available_times"
   Use when client says: 'book appointment', 'schedule', 'available', 'when', 'can I come', 'availability', 'what times do you have'

2. **FIND EARLIEST SLOT** - action="get_soonest_available"
   Use when client says: 'as soon as possible', 'earliest appointment', 'whenever', 'any time available'

3. **BOOKING** - action="book_appointment"
   Use after collecting all required information and client confirmation

4. **CANCELLATION** - action="cancel_appointment"
   Use when client wants to cancel an existing reservation

🧾 BOOKING PROCESS
1. Determine preferred date and time
2. Check availability or find earliest slot
3. Collect 4 required details:
   - First and last name
   - Email (if unable to input via voice, use: "phone@ai-recepcia.sk")
   - Phone number (verify from {{system__caller_id}})
   - Date and time

4. Summarize details: "Let me recap: Mr./Ms. …, email …, phone …, appointment … at … – do you agree?"

5. After confirmation: "One moment, I'm booking you in…" → call bookio_assistant with action="book_appointment"

6. After successful booking: "Perfect! Your appointment has been successfully booked. You will receive a confirmation email."

🧾 CANCELLATION PROCESS
1. Collect identification details (phone number is best)
2. Find reservation by phone and date
3. Confirm details: "I found your reservation on … at … – do you want to cancel it?"
4. After confirmation, call bookio_assistant with action="cancel_appointment"
```

## 🔧 TOOL CONFIGURATION (bookio_assistant) - English Reference

### Action Types and Parameters

**1. CHECK AVAILABILITY**
🔸 **WHEN TO USE:** Client wants to see available time slots for a specific date

🔸 **Parameters:**
- `action="get_available_times"`
- `date`: DD.MM.YYYY format (e.g., "18.08.2025")

**2. FIND EARLIEST AVAILABLE**
🔸 **WHEN TO USE:** Client wants the soonest possible appointment

🔸 **Parameters:**
- `action="get_soonest_available"`

**3. BOOK APPOINTMENT**
🔸 **PROCESS:** Collect all 4 required details, summarize, wait for confirmation

🔸 **Parameters:**
- `action="book_appointment"`
- `date`: DD.MM.YYYY format
- `time`: HH:MM format
- `customer`: JSON string with customer details

**4. CANCEL APPOINTMENT**
🔸 **PROCESS:** Identify reservation by phone/date, confirm cancellation

🔸 **Parameters:**
- `action="cancel_appointment"`
- `phone`: Phone number for lookup
- `appointment_date`: DD.MM.YYYY format (optional but helpful)

## 📋 BOOKING REQUIREMENTS

### Required Customer Information
1. **First Name** (Meno)
2. **Last Name** (Priezvisko)
3. **Email** (E-mail)
4. **Phone Number** (Telefónne číslo)

### Voice-Friendly Email Handling
Since email input via voice is challenging:

**Option 1: Use Phone-Based Email**
```json
{
  "email": "telefon@ai-recepcia.sk"
}
```

**Option 2: Simplified Domain Collection**
```
AI: "What email domain? Gmail, Yahoo, Outlook, or other?"
Client: "Gmail"
AI: "Username before @gmail.com?"
Client: "jan novak" → becomes "jan.novak@gmail.com"
```

**Option 3: Skip Email Collection**
```
AI: "If email input is difficult, I can use your phone number instead"
```

### Customer Data JSON Format
```json
{
  "firstName": "Ján",
  "lastName": "Novák",
  "email": "jan.novak@gmail.com",
  "phone": "+421910223761"
}
```

## 🗣️ CONVERSATION EXAMPLES

### Booking Flow
```
AI: Good day, AI Recepcia, how can I help you?
Client: I'd like to book an appointment
AI: Of course, when would suit you?
Client: Tomorrow afternoon
AI: One moment, let me check availability for tomorrow...
[Calls bookio_assistant with action="get_available_times"]
AI: Available slots are 12:15, 12:30, and 12:45. Which would work for you?
```

### Cancellation Flow
```
Client: I'd like to cancel my appointment
AI: Of course, what's your phone number?
Client: +421 910 223 761
AI: And when was your appointment scheduled?
Client: Tomorrow at 12:30
AI: I found your appointment for August 19th at 12:30 - would you like to cancel it?
[After confirmation, calls bookio_assistant with action="cancel_appointment"]
```

## 🔧 API Integration Details

### Endpoint Structure
```
POST /api/booking/webhook/elevenlabs-unified
Content-Type: application/json
```

### Request Examples

**Check Availability:**
```json
{
  "action": "get_available_times",
  "date": "18.08.2025"
}
```

**Find Soonest:**
```json
{
  "action": "get_soonest_available"
}
```

**Book Appointment:**
```json
{
  "action": "book_appointment",
  "date": "18.08.2025",
  "time": "12:30",
  "customer": "{\"firstName\":\"Ján\",\"lastName\":\"Novák\",\"email\":\"jan@example.com\",\"phone\":\"+421910223761\"}"
}
```

**Cancel Appointment:**
```json
{
  "action": "cancel_appointment",
  "phone": "+421910223761",
  "appointment_date": "18.08.2025"
}
```

## 📞 Error Handling

### Common Scenarios
1. **No Available Slots:** Suggest alternative dates
2. **Booking Conflict:** Offer different time slots
3. **Invalid Customer Data:** Ask for clarification
4. **System Error:** Apologize and offer to try again

### Response Patterns
- **Success:** Confirm booking details and next steps
- **Partial Success:** Provide available alternatives
- **Failure:** Explain issue and suggest solutions

## 🚀 Implementation Notes

### Key Differences from Medical Booking
- No specific appointment types (simpler)
- No insurance information required
- Phone number is primary identifier
- Email can be simplified for voice interaction
- No strict time slot restrictions (uses Bookio's system)

### Voice Interaction Optimizations
- Phone numbers read digit by digit
- Simplified email collection
- Natural interruption handling
- Clear confirmation before booking
- Immediate feedback after operations

### Integration Requirements
- Bookio API handles all backend logic
- No custom time slot management needed
- Built-in availability checking
- Automatic confirmation emails through Bookio

## 📋 Deployment Configuration

### ElevenLabs Settings
```json
{
  "language": "sk",
  "voice_type": "female",
  "formality": "formal",
  "interruption_handling": true,
  "response_timeout": 20,
  "max_conversation_duration": 600
}
```

### Webhook Configuration
```json
{
  "url": "https://your-domain.com/api/booking/webhook/elevenlabs-unified",
  "method": "POST",
  "timeout": 20,
  "retry_attempts": 2
}
```

This configuration provides a complete voice AI solution for booking appointments through the Bookio system, optimized for Slovak language voice interactions with simplified email handling and phone-based identification for cancellations.
