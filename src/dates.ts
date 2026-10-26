import { StatementParseError } from './errors';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function toIsoDate(year: number, month: number, day: number, original: string): string {
  const probe = new Date(Date.UTC(year, month - 1, day));
  const valid =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  if (!valid) {
    throw new StatementParseError(`invalid date "${original}"`);
  }
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** "31/10/2023" -> "2023-10-31" */
export function parseSlashDate(raw: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) {
    throw new StatementParseError(`invalid date "${raw}"`);
  }
  return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]), raw);
}

/** "01 Oct 2023" / "1 October 2023" -> "2023-10-01" */
export function parseLongDate(raw: string): string {
  const match = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/.exec(raw.trim());
  const month = match ? MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1 : 0;
  if (!match || month === 0) {
    throw new StatementParseError(`invalid date "${raw}"`);
  }
  return toIsoDate(Number(match[3]), month, Number(match[1]), raw);
}
