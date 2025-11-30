// timeUtils.ts
// Pakistan Standard Time (PKT) - Asia/Karachi
const PAKISTAN_TIMEZONE = 'Asia/Karachi';

import { format, formatInTimeZone } from "date-fns-tz";

/**
 * Returns the current date and time in the Pakistan Standard Time (PKT) time zone.
 * @returns {Date} A Date object with the current time in PKT.
 */
export function getCurrentTimeInPST(): Date {
  // Get current time in Pakistan timezone
  const now = new Date();
  const pakistanTimeString = now.toLocaleString("en-US", { timeZone: PAKISTAN_TIMEZONE });
  return new Date(pakistanTimeString);
}

/**
 * Format date in Pakistan timezone
 */
export const formatDate = (dateString: string | Date) => {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const options: Intl.DateTimeFormatOptions = { 
    day: 'numeric',  
    month: 'short', 
    year: 'numeric',
    timeZone: PAKISTAN_TIMEZONE // Explicitly set Pakistan timezone
  };
  return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
};

/**
 * Format date with extra day in Pakistan timezone
 */
export const formatDateWithExtraDay = (dateString: string | Date) => {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  // Add one day to the date
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const options: Intl.DateTimeFormatOptions = { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    timeZone: PAKISTAN_TIMEZONE // Explicitly set Pakistan timezone
  };
  return nextDay.toLocaleDateString('en-GB', options).replace(/ /g, '-');
};

/**
 * Format time in Pakistan timezone
 */
export const formatTime = (dateString: string | Date) => {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true, // Use 12-hour format
    timeZone: PAKISTAN_TIMEZONE // Explicitly set Pakistan timezone
  };
  return date.toLocaleTimeString('en-GB', options);
};

/**
 * Format date and time in Pakistan timezone
 */
export const formatDateTime = (dateString: string | Date) => {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: PAKISTAN_TIMEZONE // Explicitly set Pakistan timezone
  };
  return date.toLocaleString('en-GB', options).replace(/ /g, '-');
};

/**
 * Convert a date to UTC
 */
export function convertToUTC(date: Date): Date {
  return new Date(date.toISOString());
}

/**
 * Convert a UTC date to Pakistan Standard Time
 */
export function convertToPST(date: Date): Date {
  const pakistanTimeString = date.toLocaleString("en-US", { timeZone: PAKISTAN_TIMEZONE });
  return new Date(pakistanTimeString);
}

/**
 * Get current date/time as ISO string in Pakistan timezone
 */
export function getCurrentTimeInPSTISO(): string {
  return formatInTimeZone(new Date(), PAKISTAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
}

/**
 * Format date using date-fns-tz in Pakistan timezone
 */
export function formatDateInPakistan(date: Date, formatString: string = "yyyy-MM-dd HH:mm:ss"): string {
  return formatInTimeZone(date, PAKISTAN_TIMEZONE, formatString);
}



