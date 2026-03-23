# Quality Gates — AlvinAI Agency
**Effective: 2026-03-23 | Enforced by: CEO**

Nothing ships without passing all applicable gates.

---

## Gate 1 — Brief Before Work

**Trigger:** Any task you estimate will take >2 hours.

**What to do:** Before starting work, post a comment with exactly these 3 questions answered:

1. **What am I building?** (1–2 sentences)
2. **What do I need from you before I start?** (list blockers/inputs)
3. **What does success look like?** (measurable outcome)

**Then:** Set status to `blocked`, wait for Alvin's approval comment.
**Only after approval:** Start work.

**Who enforces it:** CEO checks every new `in_progress` issue. If Gate 1 applies and no brief was posted, CEO flags it.

---

## Gate 2 — CMO Review Before Alvin Sees Creative

**Applies to:** All ad copy, content calendars, social posts, influencer briefs, email sequences, landing page copy.

**What to do:**
1. Finish your deliverable
2. Post a comment tagging @CMO for review
3. Wait for CMO approval comment
4. Only after CMO approves → change status to `in_review`

**Alvin should never see unreviewed creative work.**

**Who enforces it:** CMO. If creative reaches `in_review` without CMO comment → CEO sends it back.

---

## Gate 3 — Budget Check Before Spend

**Applies to:** Any issue involving paid media, ad spend, tools with paid tiers, or external vendor costs.

**What to do:**
1. Before starting, post the estimated budget breakdown
2. Confirm it matches the approved budget in the campaign brief
3. CEO confirms → proceed

**Who enforces it:** CEO reviews all budget-adjacent issues before `in_progress`.

---

## Gate 4 — Completeness Check

**Applies to:** Every agent, every issue.

**Before you change status to `in_review`, your comment MUST include all three:**

- ✅ **Summary** — 3 bullets on what was done
- ✅ **Location** — where the deliverable is (issue document, attachment, URL, file path)
- ✅ **Decision needed** — what Alvin needs to approve/decide

**If any of these are missing → do not change status. Fix the comment first.**

CEO will reject any `in_review` issue missing these three fields.

---

## Document Templates (Gate 4 Extension)

All deliverables must use the correct template from `shared/templates/`.

| Deliverable type | Template to use |
|-----------------|----------------|
| Campaign plan | `campaign-brief.md` |
| Ad copy | `ad-copy.md` |
| Social content plan | `content-calendar.md` |
| Competitor research | `competitor-analysis.md` |
| Influencer partnership | `influencer-brief.md` |
| Monthly results | `monthly-client-report.md` |

Remove all `<!-- INSTRUCTIONS -->` comments before attaching to an issue or sending to client.

---

## CEO Enforcement Protocol

CEO runs this check on every issue before approving `in_review` → `done`:

```
[ ] Gate 1 — brief was posted and approved (if task >2h)
[ ] Gate 2 — CMO approved creative (if creative deliverable)
[ ] Gate 3 — budget confirmed (if paid media involved)
[ ] Gate 4 — completeness check passes (summary + location + decision)
[ ] Correct template used and instructions removed
```

If any gate fails → CEO posts a comment listing what's missing and sets status back to `in_progress`.
