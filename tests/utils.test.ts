import { loadConfig } from '../src/config';
import { parseLongDate, parseSlashDate } from '../src/dates';
import { ConfigError, StatementParseError } from '../src/errors';
import { amountToCents, centsToAmount, parseAmountToCents } from '../src/money';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('parseAmountToCents', () => {
  it('parses signed and unsigned amounts', () => {
    expect(parseAmountToCents('-45.50')).toBe(-4550);
    expect(parseAmountToCents('1500.00')).toBe(150000);
    expect(parseAmountToCents('+12.34')).toBe(1234);
  });

  it('handles missing or short fractions, thousands separators and currency symbols', () => {
    expect(parseAmountToCents('72')).toBe(7200);
    expect(parseAmountToCents('72.4')).toBe(7240);
    expect(parseAmountToCents('1,234.56')).toBe(123456);
    expect(parseAmountToCents('-£45.50')).toBe(-4550);
    expect(parseAmountToCents('$3.05')).toBe(305);
  });

  it('never returns negative zero', () => {
    expect(Object.is(parseAmountToCents('-0.00'), 0)).toBe(true);
  });

  it('rejects malformed amounts', () => {
    expect(() => parseAmountToCents('abc')).toThrow(StatementParseError);
    expect(() => parseAmountToCents('')).toThrow(StatementParseError);
    expect(() => parseAmountToCents('1.234')).toThrow(StatementParseError);
    expect(() => parseAmountToCents('1,2,3.00')).toThrow(StatementParseError);
  });
});

describe('cents helpers', () => {
  it('converts between amounts and cents without drift', () => {
    expect(amountToCents(0.1) + amountToCents(0.2)).toBe(30);
    expect(amountToCents(-45.8)).toBe(-4580);
    expect(centsToAmount(-4580)).toBe(-45.8);
    expect(Object.is(centsToAmount(0), 0)).toBe(true);
  });
});

describe('date parsing', () => {
  it('converts DD/MM/YYYY to ISO', () => {
    expect(parseSlashDate('01/10/2023')).toBe('2023-10-01');
    expect(parseSlashDate('31/12/2023')).toBe('2023-12-31');
  });

  it('accepts a leap day only in leap years', () => {
    expect(parseSlashDate('29/02/2024')).toBe('2024-02-29');
    expect(() => parseSlashDate('29/02/2023')).toThrow(StatementParseError);
  });

  it('rejects impossible or malformed dates', () => {
    expect(() => parseSlashDate('31/04/2023')).toThrow(StatementParseError);
    expect(() => parseSlashDate('00/10/2023')).toThrow(StatementParseError);
    expect(() => parseSlashDate('10/13/2023')).toThrow(StatementParseError);
    expect(() => parseSlashDate('2023-10-01')).toThrow(StatementParseError);
  });

  it('converts "DD Mon YYYY" to ISO', () => {
    expect(parseLongDate('01 Oct 2023')).toBe('2023-10-01');
    expect(parseLongDate('1 October 2023')).toBe('2023-10-01');
    expect(parseLongDate('31 dec 2023')).toBe('2023-12-31');
  });

  it('rejects unknown months and impossible days', () => {
    expect(() => parseLongDate('01 Foo 2023')).toThrow(StatementParseError);
    expect(() => parseLongDate('31 Nov 2023')).toThrow(StatementParseError);
    expect(() => parseLongDate('Oct 2023')).toThrow(StatementParseError);
  });
});

describe('loadConfig', () => {
  function writeTemp(content: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statement-config-'));
    const file = path.join(dir, 'config.json');
    fs.writeFileSync(file, content);
    return file;
  }

  it('loads the repository config.json by default', () => {
    const config = loadConfig();
    expect(config.categoryKeywords.Groceries).toContain('TESCO');
    expect(Object.keys(config.categoryKeywords)).toEqual(
      expect.arrayContaining(['Groceries', 'Transport', 'Entertainment', 'Utilities']),
    );
  });

  it('loads a custom config file', () => {
    const file = writeTemp(JSON.stringify({ categoryKeywords: { Pets: ['VET'] } }));
    expect(loadConfig(file)).toEqual({ categoryKeywords: { Pets: ['VET'] } });
  });

  it('rejects missing, unreadable and invalid configs', () => {
    expect(() => loadConfig('/definitely/not/here.json')).toThrow(ConfigError);
    expect(() => loadConfig(writeTemp('not json'))).toThrow(ConfigError);
    expect(() => loadConfig(writeTemp('{}'))).toThrow(ConfigError);
    expect(() => loadConfig(writeTemp('{"categoryKeywords": []}'))).toThrow(ConfigError);
    expect(() => loadConfig(writeTemp('{"categoryKeywords": {"A": "TESCO"}}'))).toThrow(ConfigError);
    expect(() => loadConfig(writeTemp('{"categoryKeywords": {"A": [1]}}'))).toThrow(ConfigError);
  });
});
