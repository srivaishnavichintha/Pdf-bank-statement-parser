import { StatementParseError } from '../src/errors';
import { MonzoParser } from '../src/parsers/MonzoParser';
import { RevolutParser } from '../src/parsers/RevolutParser';

describe('RevolutParser', () => {
  const parser = new RevolutParser();

  const statement = [
    'REVOLUT',
    'Statement Period: 01/10/2023 - 31/10/2023',
    'Account Holder: Sample Customer',
    '',
    'Date        Description                 Amount',
    '01/10/2023  TESCO STORES              -45.50',
    '05/10/2023  SALARY                   1500.00',
    '09/10/2023  COFFEE   AND  CAKE          -4.50',
    '',
    'End of statement',
  ].join('\n');

  it('parses signed amounts and converts dates to ISO', () => {
    expect(parser.parse(statement)).toEqual([
      { date: '2023-10-01', description: 'TESCO STORES', amount: -45.5 },
      { date: '2023-10-05', description: 'SALARY', amount: 1500 },
      { date: '2023-10-09', description: 'COFFEE AND CAKE', amount: -4.5 },
    ]);
  });

  it('reads the statement period', () => {
    expect(parser.getPeriod(statement)).toEqual({ start: '2023-10-01', end: '2023-10-31' });
  });

  it('accepts "to" and en dash as period separators', () => {
    expect(parser.getPeriod('Statement Period: 01/10/2023 to 31/10/2023')).toEqual({
      start: '2023-10-01',
      end: '2023-10-31',
    });
    expect(parser.getPeriod('Statement Period: 01/10/2023 – 31/10/2023')).toEqual({
      start: '2023-10-01',
      end: '2023-10-31',
    });
  });

  it('handles Windows line endings, thousands separators and plus signs', () => {
    const text = 'REVOLUT\r\nStatement Period: 01/10/2023 - 31/10/2023\r\n02/10/2023  RENT -1,250.00\r\n03/10/2023  REFUND +3.99\r\n';
    expect(parser.parse(text)).toEqual([
      { date: '2023-10-02', description: 'RENT', amount: -1250 },
      { date: '2023-10-03', description: 'REFUND', amount: 3.99 },
    ]);
  });

  it('throws on a date-led row without a valid amount', () => {
    expect(() => parser.parse('REVOLUT\n01/10/2023  TESCO STORES')).toThrow(StatementParseError);
    expect(() => parser.parse('REVOLUT\n01/10/2023  TESCO STORES  abc')).toThrow(StatementParseError);
  });

  it('throws on an impossible transaction date', () => {
    expect(() => parser.parse('REVOLUT\n31/02/2023  TESCO STORES  -5.00')).toThrow(StatementParseError);
  });

  it('throws when no transactions are found', () => {
    expect(() => parser.parse('REVOLUT\nStatement Period: 01/10/2023 - 31/10/2023')).toThrow(StatementParseError);
  });

  it('throws when the period is missing or reversed', () => {
    expect(() => parser.getPeriod('REVOLUT\nno period here')).toThrow(StatementParseError);
    expect(() => parser.getPeriod('Statement Period: 31/10/2023 - 01/10/2023')).toThrow(StatementParseError);
  });
});

describe('MonzoParser', () => {
  const parser = new MonzoParser();

  const statement = [
    'MONZO BANK',
    'Account Statement',
    'Period: 01 Oct 2023 to 31 Oct 2023',
    '',
    'Date: 02/10/2023',
    'Merchant: ASDA SUPERMARKET',
    'Money out: 72.40',
    '',
    'Date: 10/10/2023',
    'Merchant: EMPLOYER SALARY',
    'Money in: 1800.00',
    '',
    'End of statement',
  ].join('\n');

  it('parses money out as negative and money in as positive', () => {
    expect(parser.parse(statement)).toEqual([
      { date: '2023-10-02', description: 'ASDA SUPERMARKET', amount: -72.4 },
      { date: '2023-10-10', description: 'EMPLOYER SALARY', amount: 1800 },
    ]);
  });

  it('reads the statement period', () => {
    expect(parser.getPeriod(statement)).toEqual({ start: '2023-10-01', end: '2023-10-31' });
  });

  it('accepts full month names in the period', () => {
    expect(parser.getPeriod('Period: 1 October 2023 to 31 October 2023')).toEqual({
      start: '2023-10-01',
      end: '2023-10-31',
    });
  });

  it('is not confused by field order or extra lines inside a block', () => {
    const text = [
      'MONZO BANK',
      'Date: 02/10/2023',
      'Money out: 5',
      'Reference: ABC123',
      'Merchant:   CORNER   SHOP ',
    ].join('\n');
    expect(parser.parse(text)).toEqual([{ date: '2023-10-02', description: 'CORNER SHOP', amount: -5 }]);
  });

  it('throws when a block has no merchant or no amount', () => {
    expect(() => parser.parse('MONZO BANK\nDate: 02/10/2023\nMoney out: 5.00')).toThrow(StatementParseError);
    expect(() => parser.parse('MONZO BANK\nDate: 02/10/2023\nMerchant: SHOP')).toThrow(StatementParseError);
  });

  it('throws on duplicate fields within a block', () => {
    const duplicateMerchant = 'MONZO BANK\nDate: 02/10/2023\nMerchant: A\nMerchant: B\nMoney out: 1.00';
    const duplicateAmount = 'MONZO BANK\nDate: 02/10/2023\nMerchant: A\nMoney out: 1.00\nMoney in: 2.00';
    expect(() => parser.parse(duplicateMerchant)).toThrow(StatementParseError);
    expect(() => parser.parse(duplicateAmount)).toThrow(StatementParseError);
  });

  it('throws when fields appear before any Date line', () => {
    expect(() => parser.parse('MONZO BANK\nMerchant: SHOP\nMoney out: 1.00')).toThrow(StatementParseError);
  });

  it('throws on malformed dates and amounts', () => {
    expect(() => parser.parse('MONZO BANK\nDate: 32/10/2023\nMerchant: A\nMoney out: 1.00')).toThrow(
      StatementParseError,
    );
    expect(() => parser.parse('MONZO BANK\nDate: 02/10/2023\nMerchant: A\nMoney out: lots')).toThrow(
      StatementParseError,
    );
  });

  it('throws when no transactions are found', () => {
    expect(() => parser.parse('MONZO BANK\nPeriod: 01 Oct 2023 to 31 Oct 2023')).toThrow(StatementParseError);
  });

  it('throws when the period is missing, invalid or reversed', () => {
    expect(() => parser.getPeriod('MONZO BANK')).toThrow(StatementParseError);
    expect(() => parser.getPeriod('Period: 01 Foo 2023 to 31 Oct 2023')).toThrow(StatementParseError);
    expect(() => parser.getPeriod('Period: 31 Oct 2023 to 01 Oct 2023')).toThrow(StatementParseError);
  });
});
