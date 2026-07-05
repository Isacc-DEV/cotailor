/**
 * Date formatting utilities for CoTailor profiles.
 *
 * Storage format: "YYYY-MM" or "YYYY" (never empty).
 * Display format: American, e.g. "March 2022" or "2022".
 * A null value (work end date only) means "currently employed" -> "Present".
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Format a stored date ("YYYY-MM" or "YYYY") into American display form.
 * - "2022-03" -> "March 2022"
 * - "2022"    -> "2022"
 * - "" / undefined -> ""
 */
export function formatDate(value?: string | null): string {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const [yearStr, monthStr] = trimmed.split('-');
  const year = yearStr;

  if (!monthStr) return year;

  const monthIndex = parseInt(monthStr, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return year;

  return `${MONTHS[monthIndex]} ${year}`;
}

/**
 * Format a work-experience date range.
 * - endDate === null  -> "... - Present"
 * - endDate missing   -> just the start date
 */
export function formatDateRange(
  startDate?: string | null,
  endDate?: string | null,
): string {
  const start = formatDate(startDate);
  const end = endDate === null ? 'Present' : formatDate(endDate);

  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return '';
}

/**
 * Validate a stored date string is "YYYY-MM" or "YYYY" (year required).
 * null is allowed (used for currently-employed end dates) only if allowNull.
 */
export function isValidDate(value: unknown, allowNull = false): boolean {
  if (value === null) return allowNull;
  if (typeof value !== 'string') return false;
  return /^\d{4}(-\d{2})?$/.test(value.trim());
}
