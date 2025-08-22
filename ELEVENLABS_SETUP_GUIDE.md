# ElevenLabs Setup Guide

## 1. Prompt Configuration
Copy the **entire content** of `FINAL_PROMPT_CLEAN.md` into your ElevenLabs agent prompt field.

## 2. Tool Configuration  
Copy the **entire content** of `ELEVENLABS_TOOL_CONFIG.json` into your ElevenLabs tool configuration.

## 3. Critical Settings
- **Temperature**: 0.1 (low for consistent responses)
- **Max tokens**: 150-300 (keep responses short)
- **Stop talking and start calling tools immediately**

## 4. Usage Examples

**Service requests:**
```
User: "Chcem hydrafacial"
→ Agent calls: {"tool_name": "quick_booking", "search_term": "hydrafacial"}

User: "Koľko stojí chemický peeling?"  
→ Agent calls: {"tool_name": "quick_booking", "search_term": "chemický peeling"}
```

**Time requests:**
```
User: "15:15 máte?"
→ Agent calls: {"tool_name": "quick_booking", "search_term": "15:15 máte?"}

User: "26.08 o 15.00"
→ Agent calls: {"tool_name": "quick_booking", "search_term": "26.08 o 15.00"}
```

**General requests:**
```
User: "Aké služby máte?"
→ Agent calls: {"tool_name": "get_services_overview"}

User: "Aké máte hodiny?"
→ Agent calls: {"tool_name": "get_opening_hours"}
```

## 5. Expected Behavior
- ✅ Agent should NEVER say "Používam nástroj" or "Hľadám termín"
- ✅ Agent should call tools IMMEDIATELY without explaining
- ✅ Agent should give tool results directly to user
- ✅ Time requests are automatically detected and checked

## 6. Test Cases
After setup, test with:
1. "Chcem hydrafacial" → Should return service info + times
2. "15:15 máte?" → Should check specific time availability  
3. "26.08 o 15.00" → Should check if 15:00 is available