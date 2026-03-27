---
name: elevenlabs
description: Generate voiceovers and audio using ElevenLabs text-to-speech via the n8n workflow. Use when an agent needs to create narration, ad voiceovers, explainer audio, podcast scripts turned into audio, or any spoken audio deliverable. Triggers on phrases like "generate audio", "create a voiceover", "text to speech", "make a narration", "record this script", or any request for AI-generated voice.
---

# ElevenLabs — Text-to-Speech Skill

Generate high-quality voiceovers by calling the ElevenLabs n8n webhook.

## Endpoint

```
POST http://localhost:5678/webhook/elevenlabs-tts
Content-Type: application/json

{
  "text": "The script to convert to speech",
  "voiceId": "optional: specific voice ID (defaults to Rachel)",
  "voiceName": "optional: Rachel | Adam | Josh | Bella | Antoni | Elli",
  "stability": 0.5,
  "similarityBoost": 0.75,
  "clientContext": "optional: client name for voice matching"
}
```

## Response

```json
{
  "ok": true,
  "audioUrl": "https://...",
  "durationSeconds": 12.4,
  "voiceUsed": "Rachel",
  "characterCount": 245
}
```

## Available Voices (ElevenLabs Standard)

| Voice | Style | Best For |
|-------|-------|---------|
| Rachel | Calm, professional female | Explainers, brand narration |
| Adam | Deep, authoritative male | Ads, announcements |
| Josh | Young, energetic male | Social media, casual content |
| Bella | Warm, friendly female | Customer-facing, soft products |
| Antoni | Polished, neutral male | Corporate, B2B |
| Elli | Bright, youthful female | Youth brands, upbeat content |

## How to Use

### Step 1 — Prepare the Script

Good TTS scripts:
- Use natural conversational language (not corporate speak)
- Add pauses with commas and periods
- Spell out numbers: "two hundred" not "200"
- Use phonetic spellings for unusual words: "feng shway" not "feng shui"
- Keep sentences short (under 20 words each)
- Target 150 words per minute (so 30-sec ad = ~75 words)

### Step 2 — Choose a Voice

Match the voice to the client and content:
- Awoofi (e-commerce): Rachel or Bella — warm, approachable
- Billy Car Import: Adam or Antoni — authoritative, trustworthy
- Fengshui Connexion: Rachel or Bella — calm, wise
- Generic ad: Josh for energy, Adam for authority

### Step 3 — Call the Webhook

```python
import urllib.request, json

payload = {
    "text": "Welcome to Awoofi. Discover premium products delivered to your door.",
    "voiceName": "Rachel",
    "stability": 0.5,
    "similarityBoost": 0.75
}
req = urllib.request.Request(
    "http://localhost:5678/webhook/elevenlabs-tts",
    data=json.dumps(payload).encode(),
    method="POST"
)
req.add_header("Content-Type", "application/json")
with urllib.request.urlopen(req, timeout=30) as r:
    result = json.load(r)
    audio_url = result["audioUrl"]
```

### Step 4 — Deliver the Result

After generating:
1. Include the audio URL in your issue comment
2. Include the script text for reference
3. Note: duration, voice used, character count
4. Offer to re-generate with a different voice if needed

## Script Lengths & Use Cases

| Use Case | Target Duration | Approx Words |
|----------|----------------|--------------|
| 6-sec bumper ad | 6s | ~15 words |
| 15-sec social ad | 15s | ~38 words |
| 30-sec radio/video ad | 30s | ~75 words |
| 60-sec explainer | 60s | ~150 words |
| 2-min product demo | 2min | ~300 words |

## Quality Checks

Before delivering audio:
- [ ] Script reads naturally aloud (tested mentally)?
- [ ] Voice matches client brand?
- [ ] Duration appropriate for use case?
- [ ] Audio URL accessible and plays correctly?
- [ ] Character count noted (for billing awareness)?

## Error Handling

- `{"ok": false, "error": "ELEVENLABS_API_KEY not configured"}` → Notify Alvin: credentials needed
- `{"ok": false, "error": "quota_exceeded"}` → ElevenLabs monthly character limit hit — notify Alvin
- `{"ok": false, "error": "text_too_long"}` → Split script into chunks under 2500 chars and call multiple times
- HTTP 404 → n8n workflow not active — notify Alvin to check n8n
