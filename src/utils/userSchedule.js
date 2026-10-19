import { env } from '../config/env.js';

export const DEFAULT_SCHEDULED_POST_TIMES = [
  { hour: 10, minute: 0 },
  { hour: 14, minute: 0 },
];

export function getUserScheduledPostTimes(user) {
  const slots = user?.preferences?.scheduledPostTimes;
  if (Array.isArray(slots) && slots.length > 0) {
    return slots.map(normalizeSlot).filter(Boolean);
  }
  return DEFAULT_SCHEDULED_POST_TIMES.map(normalizeSlot);
}

export function normalizeSlot(slot) {
  if (!slot || typeof slot.hour !== 'number' || typeof slot.minute !== 'number') return null;
  const hour = Math.min(23, Math.max(0, Math.floor(slot.hour)));
  const minute = Math.min(59, Math.max(0, Math.floor(slot.minute)));
  return { hour, minute };
}

export function slotIdFromTime(hour, minute) {
  return `h${hour}-m${minute}`;
}

export function parseSlotId(slotId) {
  const m = /^h(\d{1,2})-m(\d{1,2})$/.exec(slotId || '');
  if (!m) return null;
  return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
}

export function formatSlotLabel(hour, minute) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function slotIdToLabel(slotId) {
  const parsed = parseSlotId(slotId);
  if (!parsed) return slotId;
  return formatSlotLabel(parsed.hour, parsed.minute);
}

function getLocalHourMinute(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  return {
    hour: parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10),
    minute: parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10),
  };
}

/** Slots that match the current minute in the user's timezone. */
export function getMatchingSlotsForUserNow(user, now = new Date()) {
  const tz = user.timezone || env.APP_TIMEZONE;
  const { hour, minute } = getLocalHourMinute(now, tz);
  return getUserScheduledPostTimes(user).filter((s) => s.hour === hour && s.minute === minute);
}

export function getNextScheduledRunForUser(user, now = new Date()) {
  const tz = user.timezone || env.APP_TIMEZONE;
  const slots = getUserScheduledPostTimes(user);
  const candidates = [];
  for (let dayOffset = 0; dayOffset < 2; dayOffset += 1) {
    for (const slot of slots) {
      const utcGuess = zonedTimeToUtcDate(now, tz, slot.hour, slot.minute, dayOffset);
      if (utcGuess > now) candidates.push(utcGuess);
    }
  }
  candidates.sort((a, b) => a - b);
  return candidates[0] || null;
}

/** Approximate: step through UTC until local H:M matches (handles DST reasonably for scheduling UI). */
function zonedTimeToUtcDate(base, timeZone, hour, minute, dayOffset) {
  const baseParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);
  const y = parseInt(baseParts.find((p) => p.type === 'year').value, 10);
  const mo = parseInt(baseParts.find((p) => p.type === 'month').value, 10);
  const d = parseInt(baseParts.find((p) => p.type === 'day').value, 10) + dayOffset;
  const local = new Date(Date.UTC(y, mo - 1, d, hour, minute, 0));
  const offsetMs = getTimezoneOffsetMs(local, timeZone);
  return new Date(local.getTime() - offsetMs);
}

function getTimezoneOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    parseInt(map.hour, 10),
    parseInt(map.minute, 10),
    parseInt(map.second, 10)
  );
  return asUtc - date.getTime();
}
