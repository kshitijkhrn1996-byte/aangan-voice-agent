# Aangan Studio — AI Phone Receptionist

MESA Founder's Office, Cohort C4 · Case 03 ("Nikhil: Unanswered Enquiries").

Aangan Studio left ~48% of enquiries unanswered for 48 hours, while replies within an hour convert 4× better.
This voice agent answers every call instantly, qualifies it against the founder's rubric, books a consultation
in the designer's calendar, and hands over a complete brief via HubSpot and Telegram — without ever quoting a price.

## How it works

```
Caller → Vaani voice agent (Gemini 3.5 Flash)
           ├─ mid-call tools → /api/tools/slots | book | message → Google Calendar (Apps Script bridge)
           └─ post-call webhook → /api/vaani/events
                 → Gemini: extract lead + handoff summary + guardrail audit
                 → rules engine (src/rules) re-checks qualification
                 → HubSpot deal · Telegram note (Accept button) · Supabase call log
Dashboard → /api/dashboard?key=… (volume, after-hours share, bookings, pickup time, cost)
```

## Layout

| Path | What |
|---|---|
| `api/` | Vercel functions: Vaani tools, Vaani webhook, Telegram callback, dashboard |
| `lib/` | Gemini, HubSpot, Telegram, Supabase, calendar bridge, post-call pipeline, metrics |
| `src/rules/` | Qualification rules (five criteria + service area), unit-tested in `test/` |
| `prompts/receptionist.md` | The agent's system prompt and guardrails |
| `apps-script/CalendarBridge.gs` | Google Apps Script web app for free slots and bookings |
| `scripts/` | One-off setup: HubSpot pipeline, Vaani agent prompt, Vaani tools |
| `setup/VAANI_SETUP.md` | Manual dashboard steps |

## Run

```bash
npm install
npm test
node --env-file=.env scripts/setup-hubspot.js
node --env-file=.env scripts/push-agent.js
node --env-file=.env scripts/push-tools.js
npx vercel deploy --prod
```

Secrets live in `.env` (not committed): `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`HUBSPOT_TOKEN`, `HUBSPOT_PIPELINE_ID`, `HUBSPOT_STAGE_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
`VAANI_API_KEY`, `VAANI_AGENT_ID`, `WEBHOOK_SECRET`, `BACKEND_URL`, `CALENDAR_BRIDGE_URL`, `DASHBOARD_KEY`.

## Working assumptions (pending founder confirmation)

- Hard criteria (real project, service area, timeline): one clear fail declines. Budget and decision-maker never decline alone.
- Deadline under 6 weeks declines; 6–11 weeks is flagged "tight". Site not ready within 10 weeks → nurture.
- English only for v1; non-English callers get a team callback.
