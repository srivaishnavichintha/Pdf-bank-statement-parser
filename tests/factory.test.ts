import { UnsupportedStatementFormatError } from '../src/errors';
import { MonzoParser } from '../src/parsers/MonzoParser';
import { IStatementParser } from '../src/parsers/IStatementParser';
import { RevolutParser } from '../src/parsers/RevolutParser';
import { StatementParserFactory } from '../src/parsers/StatementParserFactory';

const REVOLUT_TEXT = [
  'REVOLUT',
  'Statement Period: 01/10/2023 - 31/10/2023',
  '',
  'Date        Description                 Amount',
  '01/10/2023  TESCO STORES              -45.50',
].join('\n');

const MONZO_TEXT = [
  'MONZO BANK',
  'Account Statement',
  'Period: 01 Oct 2023 to 31 Oct 2023',
  '',
  'Date: 02/10/2023',
  'Merchant: ASDA SUPERMARKET',
  'Money out: 72.40',
].join('\n');

describe('StatementParserFactory', () => {
  it('returns a RevolutParser for Revolut statements', () => {
    const parser = StatementParserFactory.getParser(REVOLUT_TEXT);
    expect(parser).toBeInstanceOf(RevolutParser);
  });

  it('returns a MonzoParser for Monzo statements', () => {
    const parser = StatementParserFactory.getParser(MONZO_TEXT);
    expect(parser).toBeInstanceOf(MonzoParser);
  });

  it('detects the bank case-insensitively and ignores leading blank lines', () => {
    expect(StatementParserFactory.getParser(`\n\n  revolut\n${REVOLUT_TEXT}`)).toBeInstanceOf(RevolutParser);
    expect(StatementParserFactory.getParser(`\n\nMonzo Bank\n${MONZO_TEXT}`)).toBeInstanceOf(MonzoParser);
  });

  it('returns objects that satisfy the IStatementParser contract', () => {
    const parser: IStatementParser = StatementParserFactory.getParser(MONZO_TEXT);
    expect(parser.getPeriod(MONZO_TEXT)).toEqual({ start: '2023-10-01', end: '2023-10-31' });
    expect(parser.parse(MONZO_TEXT)).toEqual([
      { date: '2023-10-02', description: 'ASDA SUPERMARKET', amount: -72.4 },
    ]);
  });

  it('creates a fresh parser instance on every call', () => {
    expect(StatementParserFactory.getParser(REVOLUT_TEXT)).not.toBe(StatementParserFactory.getParser(REVOLUT_TEXT));
  });

  it('throws UnsupportedStatementFormatError for unknown formats', () => {
    expect(() => StatementParserFactory.getParser('NORTHWIND LEISURE CLUB\nInvoice')).toThrow(
      UnsupportedStatementFormatError,
    );
    expect(() => StatementParserFactory.getParser('')).toThrow(UnsupportedStatementFormatError);
    expect(() => StatementParserFactory.getParser('   \n\n  ')).toThrow(UnsupportedStatementFormatError);
  });

  it('uses the documented error message', () => {
    expect(() => StatementParserFactory.getParser('something else')).toThrow('Unsupported statement format.');
  });

  it('only inspects the statement header, not transaction text', () => {
    const monzoMentioningRevolut = MONZO_TEXT.replace('ASDA SUPERMARKET', 'TRANSFER TO REVOLUT');
    expect(StatementParserFactory.getParser(monzoMentioningRevolut)).toBeInstanceOf(MonzoParser);

    const bodyOnly = ['Some other bank', 'Statement', 'Period', 'Account', 'Currency', 'REVOLUT'].join('\n');
    expect(() => StatementParserFactory.getParser(bodyOnly)).toThrow(UnsupportedStatementFormatError);
  });

  it('does not match bank names that merely start with the same letters', () => {
    expect(() => StatementParserFactory.getParser('REVOLUTIONARY BANK\n')).toThrow(UnsupportedStatementFormatError);
    expect(() => StatementParserFactory.getParser('MONZONITE LTD\n')).toThrow(UnsupportedStatementFormatError);
  });

  it('lists the supported banks', () => {
    expect(StatementParserFactory.getSupportedBanks()).toEqual(['Revolut', 'Monzo']);
  });
});
