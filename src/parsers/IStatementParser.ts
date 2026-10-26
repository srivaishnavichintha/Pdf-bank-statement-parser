import { StatementPeriod, Transaction } from '../types';

/** Contract every bank-specific statement parser fulfils (the "product" of the factory). */
export interface IStatementParser {
  /** Extract all transactions from the raw PDF text. Debits are negative, credits positive. */
  parse(rawText: string): Transaction[];

  /** Extract the statement period (ISO dates, inclusive) from the raw PDF text. */
  getPeriod(rawText: string): StatementPeriod;
}
