---
name: web-search
description: >
  Search the web using Brave Search API. Use when you need to research a topic,
  find current information, look up competitors, check news, or gather data
  before acting on a task. Available to all agents. Requires BRAVE_SEARCH_API_KEY
  env var to be set on the VPS.
---

# Web Search Skill

Search the web via Brave Search API. Always search before acting on tasks that
require external knowledge — stop guessing, start researching.

## Prerequisites

- `BRAVE_SEARCH_API_KEY` must be set in the agent's environment or VPS env
- Brave Search API: https://api.search.brave.com/res/v1/web/search

## When to Use

- Before writing ad copy → research competitor ads, brand voice, market trends
- Before content strategy → research trending topics, keywords, audience pain points
- Before market analysis → research industry data, pricing, competitor positioning
- When asked to find facts, news, or current data
- Before any client deliverable requiring market context

## How to Call

```python
import urllib.request, json, os

def web_search(query: str, count: int = 5) -> list[dict]:
    """Search the web. Returns list of {title, url, description}."""
    api_key = os.environ.get("BRAVE_SEARCH_API_KEY")
    if not api_key:
        raise ValueError("BRAVE_SEARCH_API_KEY not set")
    
    encoded_query = urllib.parse.quote(query)
    url = f"https://api.search.brave.com/res/v1/web/search?q={encoded_query}&count={count}"
    
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/json")
    req.add_header("Accept-Encoding", "gzip")
    req.add_header("X-Subscription-Token", api_key)
    
    res = urllib.request.urlopen(req)
    data = json.loads(res.read())
    
    results = []
    for item in data.get("web", {}).get("results", []):
        results.append({
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "description": item.get("description", "")
        })
    return results

# Example usage
results = web_search("pet accessories Singapore market 2025")
for r in results:
    print(f"- {r['title']}: {r['url']}")
    print(f"  {r['description']}")
```

## Best Practices

- Use specific, targeted queries — not generic terms
- For client work, always include client's market/location (e.g. "Singapore", "Malaysia")
- Run 2-3 searches with different angles before drawing conclusions
- Cite sources in your deliverables (include URLs)
- For competitor research, search "[competitor name] [product/service] [location]"

## Query Examples

| Goal | Query |
|------|-------|
| Competitor ads | "awoofi competitors pet accessories Malaysia ads" |
| Market size | "pet accessories market size Singapore 2024 2025" |
| Content trends | "pet care content trends Instagram Singapore" |
| Pricing research | "dog accessories online store Malaysia price" |
| News monitoring | "car import Japan Malaysia news 2025" |

## Output Format

After searching, summarize findings in your issue comment:

```
## Research Findings: [Topic]

**Sources searched:** [query used]

**Key findings:**
- [finding 1] — [source URL]
- [finding 2] — [source URL]
- [finding 3] — [source URL]

**Implications for task:**
[1-2 sentence synthesis]
```

## Error Handling

- 401 → API key invalid or not set. Check BRAVE_SEARCH_API_KEY env var.
- 429 → Rate limited. Wait 1 minute and retry, or reduce query frequency.
- 422 → Query malformed. Simplify the search terms.
