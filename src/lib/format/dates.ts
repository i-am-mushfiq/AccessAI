import type { NumeralSystem } from '@/lib/domain/enums';
import { localiseDigits } from './numerals';

/**
 * Date presentation.
 *
 * Bangla month names are written out rather than obtained from Intl, because
 * `Intl.DateTimeFormat('bn-BD')` returns Bengali digits for the day and year in
 * most runtimes, which would defeat the Latin-digit default (BDS §4.3) and
 * make the numeral toggle unable to control its own output.
 */

const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
] as const;

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const EN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const BN_WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'] as const;
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export type Locale = 'bn' | 'en';

export interface DateFormatOptions {
  readonly numerals?: NumeralSystem;
  readonly style?: 'long' | 'short' | 'numeric';
  readonly withWeekday?: boolean;
}

export function formatDate(
  value: Date | number | null | undefined,
  locale: Locale,
  options: DateFormatOptions = {},
): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const { numerals = 'latin', style = 'long', withWeekday = false } = options;
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  let body: string;
  if (style === 'numeric') {
    body = `${String(day).padStart(2, '0')}/${String(monthIndex + 1).padStart(2, '0')}/${year}`;
  } else if (locale === 'bn') {
    body = `${day} ${BN_MONTHS[monthIndex]} ${year}`;
  } else {
    const months = style === 'short' ? EN_MONTHS_SHORT : EN_MONTHS;
    body = `${day} ${months[monthIndex]} ${year}`;
  }

  if (withWeekday) {
    const weekday = locale === 'bn' ? BN_WEEKDAYS[date.getDay()] : EN_WEEKDAYS[date.getDay()];
    body = `${weekday}, ${body}`;
  }
  return localiseDigits(body, numerals);
}

export function formatMonthYear(value: Date, locale: Locale, numerals: NumeralSystem = 'latin'): string {
  const months = locale === 'bn' ? BN_MONTHS : EN_MONTHS;
  return localiseDigits(`${months[value.getMonth()]} ${value.getFullYear()}`, numerals);
}

export function monthName(monthIndex: number, locale: Locale): string {
  return (locale === 'bn' ? BN_MONTHS : EN_MONTHS)[monthIndex] ?? '';
}

export function weekdayNames(locale: Locale): readonly string[] {
  return locale === 'bn' ? BN_WEEKDAYS : EN_WEEKDAYS;
}

/** Short weekday initials for calendar headers. */
export function weekdayShortNames(locale: Locale): readonly string[] {
  return locale === 'bn'
    ? ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

const MS_PER_DAY = 86_400_000;

/** Whole days between two dates, ignoring time of day. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / MS_PER_DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return daysBetween(a, b) === 0;
}

/**
 * Human relative day. Deliberately concrete near the present ("আজ", "কাল")
 * and absolute beyond a week — "in 23 days" is harder to act on than a date.
 */
export function formatRelativeDay(
  target: Date,
  locale: Locale,
  options: { now?: Date; numerals?: NumeralSystem } = {},
): string {
  const now = options.now ?? new Date();
  const numerals = options.numerals ?? 'latin';
  const diff = daysBetween(now, target);

  if (locale === 'bn') {
    if (diff === 0) return 'আজ';
    if (diff === 1) return 'আগামীকাল';
    if (diff === 2) return 'পরশু';
    if (diff === -1) return 'গতকাল';
    if (diff === -2) return 'গত পরশু';
    if (diff > 2 && diff <= 7) return localiseDigits(`${diff} দিন পরে`, numerals);
    if (diff < -2 && diff >= -7) return localiseDigits(`${Math.abs(diff)} দিন আগে`, numerals);
    return formatDate(target, 'bn', { numerals });
  }

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `In ${localiseDigits(String(diff), numerals)} days`;
  if (diff < -1 && diff >= -7) return `${localiseDigits(String(Math.abs(diff)), numerals)} days ago`;
  return formatDate(target, 'en', { numerals });
}

/** Relative time for conversation timestamps. */
export function formatTimeAgo(value: Date, locale: Locale, now: Date = new Date()): string {
  const seconds = Math.floor((now.getTime() - value.getTime()) / 1000);
  if (seconds < 60) return locale === 'bn' ? 'এখনই' : 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === 'bn' ? `${minutes} মিনিট আগে` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === 'bn' ? `${hours} ঘণ্টা আগে` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return locale === 'bn' ? `${days} দিন আগে` : `${days} days ago`;
  return formatDate(value, locale, { style: 'short' });
}

export function formatTime(value: Date, locale: Locale, numerals: NumeralSystem = 'latin'): string {
  const hours24 = value.getHours();
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  if (locale === 'bn') {
    const period = hours24 < 6 ? 'রাত' : hours24 < 12 ? 'সকাল' : hours24 < 16 ? 'দুপুর' : hours24 < 19 ? 'বিকাল' : 'রাত';
    return localiseDigits(`${period} ${hours12}:${minutes}`, numerals);
  }
  return localiseDigits(`${hours12}:${minutes} ${hours24 < 12 ? 'AM' : 'PM'}`, numerals);
}

/* ------------------------------------------------------ deadline status */

export type DeadlineUrgency = 'expired' | 'critical' | 'soon' | 'upcoming' | 'distant' | 'rolling';

/**
 * Maps a deadline to a status band. The bands drive colour AND an icon AND a
 * word — never colour alone (BDS §2.2 rule 4).
 *
 * `null` means genuinely no deadline (rolling programme), which is materially
 * different from "we do not know the deadline" and is rendered differently.
 */
export function deadlineUrgency(deadline: Date | null | undefined, now: Date = new Date()): DeadlineUrgency {
  if (!deadline) return 'rolling';
  const days = daysBetween(now, deadline);
  if (days < 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 14) return 'soon';
  if (days <= 45) return 'upcoming';
  return 'distant';
}

export function daysUntil(deadline: Date, now: Date = new Date()): number {
  return daysBetween(now, deadline);
}

/** Add days without mutating, and without DST surprises across months. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfWeek(date: Date): Date {
  // Bangladesh weeks are conventionally read Sunday-first.
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
