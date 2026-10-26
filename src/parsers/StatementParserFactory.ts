import { UnsupportedStatementFormatError } from '../errors';
import { IStatementParser } from './IStatementParser';
import { MonzoParser } from './MonzoParser';
import { RevolutParser } from './RevolutParser';

/** One supported statement format: how to recognise it and how to build its parser. */
interface ParserRegistration {
  readonly bankName: string;
  supports(rawText: string): boolean;
  create(): IStatementParser;
}

/**
 * Registry of supported formats. To support a new bank, implement IStatementParser
 * and add one entry here - nothing else in the application needs to change.
 */
const REGISTRATIONS: readonly ParserRegistration[] = [
  {
    bankName: 'Revolut',
    supports: (rawText) => RevolutParser.supports(rawText),
    create: () => new RevolutParser(),
  },
  {
    bankName: 'Monzo',
    supports: (rawText) => MonzoParser.supports(rawText),
    create: () => new MonzoParser(),
  },
];

/**
 * Factory: inspects the extracted PDF text and returns the matching concrete parser.
 * Callers only ever see the IStatementParser abstraction.
 */
export class StatementParserFactory {
  static getParser(rawText: string): IStatementParser {
    const registration = REGISTRATIONS.find((candidate) => candidate.supports(rawText));
    if (!registration) {
      throw new UnsupportedStatementFormatError(StatementParserFactory.getSupportedBanks());
    }
    return registration.create();
  }

  static getSupportedBanks(): string[] {
    return REGISTRATIONS.map((registration) => registration.bankName);
  }
}
