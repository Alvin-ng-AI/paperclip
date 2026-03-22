---
name: telegram-send
description: >
  Send a Telegram message to Alvin via the Oreo Bridge. Use when you need to
  notify Alvin about task completions, blockers, approvals needed, or any
  important update that warrants immediate attention. Available to all agents.
  Do NOT spam — only use for completions, blockers, and approvals.
---

# Telegram Send Skill

Send a Telegram message to Alvin via the Oreo Bridge running on this VPS.

## When to Use

- Task completed → notify Alvin with summary + review link
- Blocked → alert Alvin with what's needed to unblock
- Approval needed → prompt Alvin with context and what action to take
- Phase completion → summary of all completed deliverables
- Critical error → immediate escalation

**Do NOT use for:** routine progress updates mid-task, informational commentary, or anything Alvin doesn't need to act on.

## How to Call

```bash
curl -s -X POST http://localhost:18795/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Your message here"}'
```

For messages with special characters, markdown, or backticks — use Python to avoid shell quoting issues:

```python
import urllib.request, json

body = {"message": "Your message here"}
req = urllib.request.Request(
    "http://localhost:18795/notify",
    data=json.dumps(body).encode(),
    method="POST"
)
req.add_header("Content-Type", "application/json")
res = urllib.request.urlopen(req)
print(res.status, res.read())
```

## Message Format

Keep messages concise. Use Telegram markdown (single `*bold*`, no `**double**`).

**For task completion:**
```
\u2705 *[Task name]*

What was shipped:
\u2022 [bullet 1]
\u2022 [bullet 2]

Live at: [URL or location]
Review: [ALV-XX in Paperclip]
```

**For blocker:**
```
\U0001f534 *BLOCKED -- [Task name]*

What's stuck: [one sentence]
What I need: [specific ask]
Issue: [ALV-XX]
```

**For approval needed:**
```
\U0001f440 *Needs your review -- [Task name]*

[1-2 sentence summary]
Action: [what Alvin should do]
Issue: [ALV-XX]
```

## Response Codes

- `{"ok": true}` -- message delivered to Telegram
- Any error -> Oreo Bridge may be down. Check: `pm2 status` (as root) or try again next heartbeat.

## Notes

- Oreo Bridge runs on port 18795 (localhost only -- not exposed externally)
- Always use Python `urllib.request` for messages containing backticks, markdown, or special chars
- Bridge token is refreshed by the heartbeat via `POST http://localhost:18795/internal/refresh-token {"token": "$PAPERCLIP_API_KEY"}`
- If the bridge is down, leave a comment on the issue instead -- do not block the heartbeat
