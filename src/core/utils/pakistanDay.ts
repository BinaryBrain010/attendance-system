/**
 * Pakistan-timezone day boundaries for DB queries. The AMS tables store DateTime as
 * `timestamp without time zone` holding the UTC wall-clock. A raw ($queryRawUnsafe) query is the
 * tricky case: the pg driver serializes a JS Date parameter in the PROCESS-LOCAL timezone, which does
 * NOT match the UTC-naive column — so a "today" window built with `new Date(); setHours(0,0,0,0)` and
 * passed as a Date is off by the local offset and, between ~00:00–05:00 PKT, excludes today's rows.
 *
 * Use getStartOfDayPakistan/getEndOfDayPakistan to get the correct UTC INSTANT for the PKT day, and
 * `toPgUtcTimestamp` to pass it to a raw query as a UTC-naive string compared with `$n::timestamp`.
 * (Prisma's own where-clauses accept the Date instants directly — only raw params need the string.)
 */
import { formatInTimeZone } from "date-fns-tz";

const PAKISTAN_TIMEZONE = "Asia/Karachi"; // UTC+5, no DST

/** The UTC instant at 00:00:00.000 of `date`'s Pakistan calendar day. */
export function getStartOfDayPakistan(date: Date = new Date()): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "yyyy"));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "MM")) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "dd"));
  const d = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  d.setUTCHours(d.getUTCHours() - 5); // 00:00 PKT = 19:00 previous day UTC
  return d;
}

/** The UTC instant at 23:59:59.999 of `date`'s Pakistan calendar day. */
export function getEndOfDayPakistan(date: Date = new Date()): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "yyyy"));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "MM")) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "dd"));
  const d = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  d.setUTCHours(d.getUTCHours() - 5);
  return d;
}

/**
 * Format a UTC instant as a UTC-naive timestamp string ("YYYY-MM-DD HH:mm:ss.SSS") for a raw query,
 * to be compared with a `timestamp without time zone` column via `$n::timestamp`. This sidesteps the
 * pg driver's local-timezone serialization of Date parameters.
 */
export function toPgUtcTimestamp(d: Date): string {
  return d.toISOString().slice(0, 23).replace("T", " ");
}
