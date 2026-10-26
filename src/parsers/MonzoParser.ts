import { StatementParseError } from '../errors';
import { parseLongDate, parseSlashDate } from '../dates';
import { centsToAmount, negate, parseAmountToCents } from '../money';
import { StatementPeriod, Transaction } from '../types';
import { IStatementParser } from './IStatementParser';
import { headerMatches, normalizeWhitespace, splitLines } from './textUtils';

/**
 * Format B ("MONZO BANK"): key/value blocks, one block per transaction.
 *
 *   MONZO BANK
 *   Account Statement
 *   Period: 01 Oct 2023 to 31 Oct 2023
 *
 *   Date: 02/10/2023
 *   Merchant: ASDA SUPERMARKET
 *   Money out: 72.40
 */
const HEADER_PATTERN = /^MONZO\b/i;
const LONG_DATE = '\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4}';
const PERIOD_PATTERN = new RegExp(`^\\s*Period:\\s*(${LONG_DATE})\\s+to\\s+(${LONG_DATE})`, 'im');
const DATE_LINE = /^Date:\s*(.*)$/i;
const MERCHANT_LINE = /^Merchant:\s*(.*)$/i;
const MONEY_OUT_LINE = /^Money out:\s*(.*)$/i;
const MONEY_IN_LINE = /^Money in:\s*(.*)$/i;

interface TransactionBlock {
  date: string;
  merchant?: string;
  /** Signed amount in cents. */
  cents?: number;
}

export class MonzoParser implements IStatementParser {
  static supports(rawText: string): boolean {
    return headerMatches(rawText, HEADER_PATTERN);
  }

  parse(rawText: string): Transaction[] {
    const transactions: Transaction[] = [];
    let block: TransactionBlock | undefined;

    const flush = (): void => {
      if (block) {
        transactions.push(toTransaction(block));
        block = undefined;
      }
    };

    for (const line of splitLines(rawText)) {
      const dateMatch = DATE_LINE.exec(line);
      if (dateMatch) {
        flush();
        block = { date: parseSlashDate(dateMatch[1]) };
        continue;
      }

      const merchantMatch = MERCHANT_LINE.exec(line);
      const outMatch = MONEY_OUT_LINE.exec(line);
      const inMatch = MONEY_IN_LINE.exec(line);
      if (!merchantMatch && !outMatch && !inMatch) {
        continue; // header, footer, blank lines
      }
      if (!block) {
        throw new StatementParseError(`"${line}" appears before any "Date:" line`);
      }

      if (merchantMatch) {
        if (block.merchant !== undefined) {
          throw new StatementParseError(`duplicate merchant in transaction dated ${block.date}`);
        }
        block.merchant = normalizeWhitespace(merchantMatch[1]);
      } else {
        if (block.cents !== undefined) {
          throw new StatementParseError(`more than one amount in transaction dated ${block.date}`);
        }
        const cents = parseAmountToCents(((outMatch ?? inMatch) as RegExpExecArray)[1]);
        block.cents = outMatch ? negate(cents) : cents;
      }
    }
    flush();

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
    const period = { start: parseLongDate(match[1]), end: parseLongDate(match[2]) };
    if (period.start > period.end) {
      throw new StatementParseError(`statement period ends before it starts (${period.start} > ${period.end})`);
    }
    return period;
  }
}

function toTransaction(block: TransactionBlock): Transaction {
  if (!block.merchant) {
    throw new StatementParseError(`missing merchant in transaction dated ${block.date}`);
  }
  if (block.cents === undefined) {
    throw new StatementParseError(`missing amount in transaction dated ${block.date}`);
  }
  return { date: block.date, description: block.merchant, amount: centsToAmount(block.cents) };
}
