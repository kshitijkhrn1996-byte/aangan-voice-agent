# Manual setup steps

Values in `<ANGLE_BRACKETS>` come from your local `.env` — never commit them.

## 1. Vaani custom tools
Registered in the Vaani dashboard (agent → Persona → Actions → Custom Tools), then given their
URLs and auth header by `node --env-file=.env scripts/push-tools.js`:
`check_slots`, `aangan_book_consult`, `aangan_leave_message`.

## 2. Vaani webhook (Developers → Webhooks → New End Point)
- URL: `https://<BACKEND_HOST>/api/vaani/events?key=<WEBHOOK_SECRET>`
- Events: call_started, call_ended, call_postprocessing

## 3. Apps Script (Calendar Bridge)
1. Paste `apps-script/CalendarBridge.gs` into a new project at script.google.com.
2. Project Settings → Script Properties → `SECRET` = `<WEBHOOK_SECRET>`.
3. Deploy → Web app (Execute as: Me, Access: Anyone) → authorise → copy the `/exec` URL into `CALENDAR_BRIDGE_URL`.

## 4. Supabase
Project Settings → API Keys → secret key → `SUPABASE_SERVICE_ROLE_KEY`.
