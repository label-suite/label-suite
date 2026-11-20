/**
 * The single entry point to day.js (frontend-agent-rules F10, design D12).
 *
 * Server instants are shown in the viewer's device time zone; no time zone is
 * hard-coded here. Business-page formats are out of scope for this change.
 */
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Formats a UTC offset in minutes as `UTC+8`, `UTC-5`, `UTC+0` or `UTC+5:30`. */
function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const minutePart = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `UTC${sign}${String(hours)}${minutePart}`;
}

/**
 * Formats an ISO 8601 UTC instant for the dev pages as
 * `YYYY-MM-DD HH:mm:ss（UTC±H）`, where the bracket shows the offset in effect
 * at that instant in the given time zone.
 *
 * @param value An ISO 8601 UTC instant, e.g. `2026-11-20T08:15:30.123Z`.
 * @param timeZone An IANA time zone; defaults to the zone the device reports.
 */
export function formatDevCheckTime(value: string, timeZone?: string): string {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = dayjs.utc(value).tz(zone);
  return `${local.format("YYYY-MM-DD HH:mm:ss")}（${formatOffset(local.utcOffset())}）`;
}
