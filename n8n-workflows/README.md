# CLAWD OS — n8n Workflows

n8n is the automation backbone for CLAWD OS. Running on VPS at port 5678.

## Architecture

```
Agent (heartbeat) → calls skill webhook → skill proxies to n8n → n8n calls external API → returns result
```

Each Phase 2.5 "skill" = a thin webhook that routes to an n8n workflow.
No custom integration code — n8n handles all 400+ API connectors.

## n8n Access

- **Local**: http://localhost:5678
- **Health check**: http://localhost:5678/healthz → {"status":"ok"}
- **Data dir**: /root/.n8n/

## Planned Workflows (Phase 2.5)

### Priority 1 — Foundation
| Workflow | Trigger | Action | Status |
|----------|---------|--------|--------|
| `telegram-send` | POST /webhook/telegram-send | Send message to Alvin's Telegram | 🔴 Needs bot token |
| `web-search` | POST /webhook/web-search | Brave Search API → return results | 🟡 Planned |

### Priority 2 — Agency Tools
| Workflow | Trigger | Action | Status |
|----------|---------|--------|--------|
| `meta-ads-fetch` | POST /webhook/meta-ads | Meta Ads API → performance data | 🟡 Planned |
| `google-sheets-append` | POST /webhook/sheets-append | Append row to Google Sheet | 🟡 Planned |
| `nano-banana` | POST /webhook/nano-banana | Gemini Image API → generate image | 🟡 Planned |

### Priority 3 — Specialist
| Workflow | Trigger | Action | Status |
|----------|---------|--------|--------|
| `elevenlabs-tts` | POST /webhook/elevenlabs | ElevenLabs → audio file URL | 🟡 Planned |
| `shopify-sales` | POST /webhook/shopify-sales | Shopify API → sales data for Awoofi | 🟡 Planned |
| `google-analytics` | POST /webhook/ga4 | GA4 API → traffic data | 🟡 Planned |

## Skill Proxy Architecture

Each skill = a single Express endpoint that calls the corresponding n8n webhook:

```js
// Example: /skills/web-search/index.js
app.post('/search', async (req, res) => {
  const result = await fetch('http://localhost:5678/webhook/web-search', {
    method: 'POST',
    body: JSON.stringify({ query: req.body.query })
  });
  res.json(await result.json());
});
```

## Workflow File Naming

Export n8n workflows as JSON and save here:
- `telegram-send.json`
- `web-search.json`
- `meta-ads-fetch.json`
- etc.

## n8n Workflow Builder: Phase 3 Automation Rules

These will be built directly in n8n (no custom code):
- "If Awoofi ad CTR < 2% → trigger CMO task"
- "Every Monday 9am MYT → CEO sends weekly brief"
- "New iProperty listing in Subang Jaya → scrape and report"
- "When issue marked done → notify Alvin on Telegram"
