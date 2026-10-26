import { StatementParseError } from './errors';

const AMOUNT_PATTERN = /^([+-])?\s*[£$€]?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/**
 * Convert a printed amount (e.g. "-1,234.50", "+£12.00", "72.4") into integer minor units (cents).
 * Working in integers avoids floating-point drift when amounts are added up.
 */
export function parseAmountToCents(raw: string): number {
  const match = AMOUNT_PATTERN.exec(raw.trim());
  if (!match) {
    throw new StatementParseError(`invalid amount "${raw}"`);
  }
  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole.replace(/,/g, '')) * 100 + Number(fraction.padEnd(2, '0'));
  return sign === '-' ? negate(cents) : cents;
}

/** Integer minor units -> decimal number (never returns -0). */
export function centsToAmount(cents: number): number {
  return cents === 0 ? 0 : cents / 100;
}

/** Decimal number -> integer minor units. */
export function amountToCents(amount: number): number {
  const cents = Math.round(amount * 100);
  return cents === 0 ? 0 : cents;
}

export function negate(cents: number): number {
  return cents === 0 ? 0 : -cents;
}
