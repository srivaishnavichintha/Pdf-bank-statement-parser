import { StatementParseError } from '../errors';
import { parseSlashDate } from '../dates';
import { centsToAmount, parseAmountToCents } from '../money';
import { StatementPeriod, Transaction } from '../types';
import { IStatementParser } from './IStatementParser';
import { headerMatches, normalizeWhitespace, splitLines } from './textUtils';

/**
 * Format A ("REVOLUT"): one table row per transaction.
 *
 *   REVOLUT
 *   Statement Period: 01/10/2023 - 31/10/2023
 *   Date        Description                 Amount
 *   01/10/2023  TESCO STORES              -45.50
 */
const HEADER_PATTERN = /^REVOLUT\b/i;
const PERIOD_PATTERN =
  /Statement Period:\s*(\d{2}\/\d{2}\/\d{4})\s*(?:-|–|—|to)\s*(\d{2}\/\d{2}\/\d{4})/i;
const STARTS_WITH_DATE = /^\d{2}\/\d{2}\/\d{4}\b/;
const TRANSACTION_ROW = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([+-]?[£$€]?\d[\d,]*\.\d{2})$/;

export class RevolutParser implements IStatementParser {
  static supports(rawText: string): boolean {
    return headerMatches(rawText, HEADER_PATTERN);
  }

  parse(rawText: string): Transaction[] {
    const transactions: Transaction[] = [];

    for (const line of splitLines(rawText)) {
      if (!STARTS_WITH_DATE.test(line)) {
        continue; // header, column titles, footer, blank lines
      }
      const match = TRANSACTION_ROW.exec(line);
      if (!match) {
        throw new StatementParseError(`malformed transaction row "${line}"`);
      }
      const [, date, description, amount] = match;
      transactions.push({
        date: parseSlashDate(date),
        description: normalizeWhitespace(description),
        amount: centsToAmount(parseAmountToCents(amount)),
      });
    }

    if (transactions.length === 0) {
      throw new StatementParseError('no transactions found');
    }
    return transactions;
  }

  getPeriod(rawText: string): StatementPeriod {
    const match = PERIOD_PATTERN.exec(rawText);
    if (!match) {
      throw new StatementParseError('statement period not found');
    }
    return validatePeriod({ start: parseSlashDate(match[1]), end: parseSlashDate(match[2]) });
  }
}

function validatePeriod(period: StatementPeriod): StatementPeriod {
  if (period.start > period.end) {
    throw new StatementParseError(`statement period ends before it starts (${period.start} > ${period.end})`);
  }
  return period;
}
