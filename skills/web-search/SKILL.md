# Web Search Skill

Search the live web using the Brave Search API bridge running on this VPS.

## When to Use

Use web search before making claims about current events, prices, competitor activity, trending topics, or any information that changes over time. Do NOT guess — search first.

**Good uses:**
- Research before writing ad copy (trends, competitor ads, product reviews)
- Check current pricing or market data
- Find recent news about a client's industry
- Verify a fact before including it in deliverables
- SEO keyword research (search for what people are searching)

**Not needed for:**
- Internal Paperclip operations (use the paperclip skill)
- Creative tasks where you supply the ideas
- Code you already know

## How to Call

```bash
curl -s "http://localhost:18799/search?q=YOUR+QUERY&count=5"
```

Or with Python (preferred for complex queries):

```python
import urllib.request, json
from urllib.parse import urlencode

params = urlencode({'q': 'your search query', 'count': 5})
req = urllib.request.Request(f'http://localhost:18799/search?{params}')
res = urllib.request.urlopen(req, timeout=10)
data = json.loads(res.read().decode())

for r in data.get('results', []):
    print(r['title'])
    print(r['url'])
    print(r.get('description', ''))
    print()
```

## Parameters

| Param | Description | Default |
|-------|-------------|---------|
| `q` | Search query (required) | — |
| `count` | Number of results (max 10) | 5 |
| `freshness` | `pd` = past day, `pw` = past week, `pm` = past month | all time |

## Response Format

```json
{
  "ok": true,
  "query": "your query",
  "count": 5,
  "results": [
    {
      "title": "Page title",
      "url": "https://...",
      "description": "Short excerpt from the page"
    }
  ],
  "news": [
    {
      "title": "News headline",
      "url": "https://...",
      "age": "2 hours ago"
    }
  ]
}
```

## Health Check

```bash
curl http://localhost:18799/health
# {"ok":true,"hasKey":true,"port":18799}
```

## Notes

- Bridge runs on port 18799 (localhost only)
- Results are from Brave Search — real-time web index
- News results (if any) appear in the `news` array alongside `results`
- Use `freshness=pw` when researching trending topics or recent campaigns
- Max 10 results per request
