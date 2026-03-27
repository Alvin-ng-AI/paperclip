---
name: nano-banana
description: Generate images using Gemini Imagen via the Nano Banana n8n workflow. Use when an agent needs to create an image, visual asset, banner, social media graphic, or any image-based deliverable. Triggers on phrases like "generate an image", "create a visual", "make a banner", "design a graphic", or any request for AI-generated imagery.
---

# Nano Banana — Image Generation Skill

Generate images by calling the Nano Banana n8n webhook, which proxies to Gemini Imagen 3.

## Endpoint

```
POST http://localhost:5678/webhook/nano-banana
Content-Type: application/json

{
  "prompt": "your detailed image prompt here",
  "style": "photorealistic | illustrated | minimalist | brand",
  "aspectRatio": "1:1 | 16:9 | 9:16 | 4:3",
  "clientContext": "optional: client name for brand-aware generation"
}
```

## Response

```json
{
  "ok": true,
  "imageUrl": "https://...",
  "prompt": "the prompt used",
  "model": "imagen-3.0"
}
```

## How to Use

### Step 1 — Write a Strong Prompt

Effective prompts include:
- **Subject**: What is in the image?
- **Style**: Photorealistic, illustrated, flat design, etc.
- **Mood/Tone**: Professional, warm, energetic, minimalist
- **Composition**: Close-up, wide shot, overhead, etc.
- **Brand context**: Include client colors, style guide notes if available

Example prompts:
- `"Minimalist product photo of a white ceramic mug on a marble surface, soft natural light, clean background, professional product photography"`
- `"Energetic lifestyle photo of young Singaporeans using a car import service, modern city background, warm golden hour lighting, 16:9"`
- `"Feng shui consultation scene, wise advisor with compass, traditional Chinese elements, warm jade and gold color palette, illustrated style"`

### Step 2 — Call the Webhook

```python
import urllib.request, json

payload = {
    "prompt": "your prompt here",
    "style": "photorealistic",
    "aspectRatio": "16:9"
}
req = urllib.request.Request(
    "http://localhost:5678/webhook/nano-banana",
    data=json.dumps(payload).encode(),
    method="POST"
)
req.add_header("Content-Type", "application/json")
with urllib.request.urlopen(req, timeout=30) as r:
    result = json.load(r)
    image_url = result["imageUrl"]
```

### Step 3 — Deliver the Result

After generating:
1. Include the image URL in your issue comment
2. Add a markdown image embed: `![Generated Image](image_url)`
3. Include the prompt used so Alvin can refine if needed
4. Offer 1–2 prompt variations for alternatives

## Writing Prompts for Client Work

### Awoofi (e-commerce, Singapore)
- Style: Clean, modern, bright
- Colors: White, light grays, accent colors matching product
- Tone: Aspirational lifestyle, young professionals

### Billy Car Import
- Style: Professional automotive photography
- Colors: Dark, premium feel (navy, charcoal, silver)
- Tone: Trust, reliability, expertise

### Fengshui Connexion
- Style: Traditional meets modern, consultative
- Colors: Jade green, gold, warm earth tones
- Tone: Wisdom, calm, auspicious

## Quality Checks

Before delivering an image:
- [ ] Prompt is detailed enough (15+ words)?
- [ ] Style matches client brand?
- [ ] Aspect ratio matches intended use (social = 1:1 or 9:16, banner = 16:9)?
- [ ] Image URL accessible and loads correctly?
- [ ] Prompt included in comment for Alvin's reference?

## Error Handling

If the webhook returns an error:
- `{"ok": false, "error": "GEMINI_API_KEY not configured"}` → Notify Alvin: credentials needed
- `{"ok": false, "error": "timeout"}` → Retry once, then flag as blocked
- HTTP 404 → n8n workflow not active — notify Alvin to check n8n
