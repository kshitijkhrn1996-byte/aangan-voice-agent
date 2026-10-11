/**
 * Aangan Studio — Google Calendar bridge.
 * Runs inside your Google account as a Web App, so the backend never needs
 * Google OAuth credentials. Paste into script.google.com, add Script Property
 * SECRET = WEBHOOK_SECRET from .env, then Deploy → Web app
 * (Execute as: Me, Who has access: Anyone).
 *
 * POST body: { secret, action, ... }
 *   action "setup" → creates one calendar per designer name, returns ids
 *   action "slots" → next free consultation slots on a calendar
 *   action "book"  → creates the event and emails the caller an invite
 */

// Set once in Project Settings → Script Properties: SECRET = WEBHOOK_SECRET from .env
const SECRET = PropertiesService.getScriptProperties().getProperty('SECRET');

const TZ = 'Asia/Kolkata';
const OPEN_HOUR = 10;          // studio hours 10am–7pm
const CLOSE_HOUR = 19;
const WORK_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const SLOT_MINUTES = 45;
const STEP_MINUTES = 30;
const MIN_NOTICE_HOURS = 2;
const SEARCH_DAYS = 7;

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad_json' });
  }
  if (!SECRET || req.secret !== SECRET) return json({ ok: false, error: 'unauthorised' });

  try {
    if (req.action === 'setup') return json({ ok: true, calendars: setup(req.names || []) });
    if (req.action === 'slots') return json({ ok: true, slots: freeSlots(req.calendar_id, req.count || 3) });
    if (req.action === 'book') return json(Object.assign({ ok: true }, book(req)));
    return json({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function setup(names) {
  return names.map(function (name) {
    const title = 'Aangan – ' + name;
    const existing = CalendarApp.getCalendarsByName(title)[0];
    const cal = existing || CalendarApp.createCalendar(title, { timeZone: TZ });
    return { name: name, calendar_id: cal.getId() };
  });
}

function freeSlots(calendarId, count) {
  const cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('calendar_not_found');

  const now = new Date();
  const earliest = new Date(now.getTime() + MIN_NOTICE_HOURS * 3600 * 1000);
  const end = new Date(now.getTime() + SEARCH_DAYS * 24 * 3600 * 1000);
  const busy = cal.getEvents(now, end).map(function (ev) {
    return [ev.getStartTime().getTime(), ev.getEndTime().getTime()];
  });

  const slots = [];
  for (let d = 0; d <= SEARCH_DAYS && slots.length < count; d++) {
    const day = new Date(now.getTime() + d * 24 * 3600 * 1000);
    const ymd = Utilities.formatDate(day, TZ, 'yyyy-MM-dd');
    const dow = Number(Utilities.formatDate(day, TZ, 'u')); // 1=Mon … 7=Sun
    if (WORK_DAYS.indexOf(dow) === -1) continue;

    for (let m = OPEN_HOUR * 60; m + SLOT_MINUTES <= CLOSE_HOUR * 60 && slots.length < count; m += STEP_MINUTES) {
      const start = istDate(ymd, m);
      const stop = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
      if (start < earliest) continue;
      const clash = busy.some(function (b) { return start.getTime() < b[1] && stop.getTime() > b[0]; });
      if (clash) continue;
      slots.push({ start_iso: Utilities.formatDate(start, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"), say: spoken(start) });
      // Spread offers out: at most one slot per half-day.
      m = m < 13 * 60 ? 13 * 60 - STEP_MINUTES : CLOSE_HOUR * 60;
    }
  }
  return slots;
}

function book(req) {
  const cal = CalendarApp.getCalendarById(req.calendar_id);
  if (!cal) throw new Error('calendar_not_found');
  const start = new Date(req.start_iso);
  const stop = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
  if (cal.getEvents(start, stop).length > 0) return { ok: false, error: 'slot_taken' };

  const opts = { description: req.description || '' };
  if (req.guest_email) {
    opts.guests = req.guest_email;
    opts.sendInvites = true;
  }
  const ev = cal.createEvent(req.title || 'Aangan Studio – Design Consultation', start, stop, opts);
  return { event_id: ev.getId(), start_iso: req.start_iso, say: spoken(start) };
}

// Minutes-after-midnight on an IST calendar day → Date.
function istDate(ymd, minutes) {
  const hh = ('0' + Math.floor(minutes / 60)).slice(-2);
  const mm = ('0' + (minutes % 60)).slice(-2);
  return new Date(ymd + 'T' + hh + ':' + mm + ':00+05:30');
}

function spoken(date) {
  return Utilities.formatDate(date, TZ, "EEEE d MMMM 'at' h:mm a");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
