import * as path from 'path';
import { InputFileNotFoundError, PdfExtractionError, UnsupportedStatementFormatError } from '../src/errors';
import { extractText } from '../src/pdfExtractor';
import { processStatement } from '../src/pipeline';
import { StatementParserFactory } from '../src/parsers/StatementParserFactory';
import { MonzoParser } from '../src/parsers/MonzoParser';
import { RevolutParser } from '../src/parsers/RevolutParser';
import * as fs from 'fs';
import * as os from 'os';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const FORMAT_A = path.join(FIXTURES, 'statement_format_a.pdf');
const FORMAT_B = path.join(FIXTURES, 'statement_format_b.pdf');
const UNSUPPORTED = path.join(FIXTURES, 'unsupported.pdf');

describe('PDF fixtures', () => {
  it('are real PDF files', () => {
    for (const file of [FORMAT_A, FORMAT_B, UNSUPPORTED]) {
      const bytes = fs.readFileSync(file);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    }
  });
});

describe('extractText (real pdf-parse)', () => {
  it('extracts selectable text from format A', async () => {
    const text = await extractText(FORMAT_A);
    expect(text).toContain('REVOLUT');
    expect(text).toContain('Statement Period: 01/10/2023 - 31/10/2023');
    expect(text).toContain('TESCO STORES');
  });

  it('extracts selectable text from format B (multi-page)', async () => {
    const text = await extractText(FORMAT_B);
    expect(text).toContain('MONZO BANK');
    expect(text).toContain('Merchant: ASDA SUPERMARKET');
    expect(text).toContain('Merchant: CORNER BOOKSHOP');
  });
});

describe('PDF -> factory -> parser', () => {
  it('selects the Revolut parser for format A', async () => {
    expect(StatementParserFactory.getParser(await extractText(FORMAT_A))).toBeInstanceOf(RevolutParser);
  });

  it('selects the Monzo parser for format B', async () => {
    expect(StatementParserFactory.getParser(await extractText(FORMAT_B))).toBeInstanceOf(MonzoParser);
  });

  it('parses every transaction of format A', async () => {
    const rawText = await extractText(FORMAT_A);
    const transactions = StatementParserFactory.getParser(rawText).parse(rawText);
    expect(transactions).toHaveLength(14);
    expect(transactions[0]).toEqual({ date: '2023-10-01', description: 'TESCO STORES', amount: -45.5 });
    expect(transactions[2]).toEqual({ date: '2023-10-05', description: 'SALARY', amount: 1500 });
  });

  it('parses every transaction of format B', async () => {
    const rawText = await extractText(FORMAT_B);
    const transactions = StatementParserFactory.getParser(rawText).parse(rawText);
    expect(transactions).toHaveLength(14);
    expect(transactions[0]).toEqual({ date: '2023-10-02', description: 'ASDA SUPERMARKET', amount: -72.4 });
    expect(transactions[5]).toEqual({ date: '2023-10-10', description: 'EMPLOYER SALARY', amount: 1800 });
  });
});

describe('processStatement (complete workflow)', () => {
  it('produces the exact expected JSON for format A (Revolut)', async () => {
    const result = await processStatement(FORMAT_A);
    expect(result).toEqual({
      period: '2023-10-01_to_2023-10-31',
      summary: {
        Groceries: -135.25,
        Transport: -43.2,
        Entertainment: -26.98,
        Utilities: -167.3,
        Uncategorized: -17,
      },
      totalExpenses: -389.73,
      totalIncome: 1545,
    });
  });

  it('produces the exact expected JSON for format B (Monzo)', async () => {
    const result = await processStatement(FORMAT_B);
    expect(result).toEqual({
      period: '2023-10-01_to_2023-10-31',
      summary: {
        Groceries: -130.4,
        Transport: -52,
        Entertainment: -26.98,
        Utilities: -89.8,
        Uncategorized: -24.8,
      },
      totalExpenses: -323.98,
      totalIncome: 2050,
    });
  });

  it('keeps category totals consistent with totalExpenses', async () => {
    for (const file of [FORMAT_A, FORMAT_B]) {
      const result = await processStatement(file);
      const categoryTotal = Object.values(result.summary).reduce((sum, value) => sum + Math.round(value * 100), 0);
      expect(categoryTotal).toBe(Math.round(result.totalExpenses * 100));
    }
  });

  it('serialises to valid JSON', async () => {
    const result = await processStatement(FORMAT_A);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('uses a custom category configuration when one is supplied', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statement-int-'));
    const configPath = path.join(dir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ categoryKeywords: { Everything: ['TESCO', 'UBER'] } }));

    const result = await processStatement(FORMAT_A, { configPath });
    expect(result.summary.Everything).toBe(-63.7);
    expect(result.summary.Groceries).toBe(undefined);
    expect(result.totalExpenses).toBe(-389.73);
  });

  it('rejects an unsupported PDF with UnsupportedStatementFormatError', async () => {
    await expect(processStatement(UNSUPPORTED)).rejects.toBeInstanceOf(UnsupportedStatementFormatError);
    await expect(processStatement(UNSUPPORTED)).rejects.toThrow('Unsupported statement format.');
  });

  it('rejects a missing file with InputFileNotFoundError', async () => {
    const missing = path.join(FIXTURES, 'does-not-exist.pdf');
    await expect(processStatement(missing)).rejects.toBeInstanceOf(InputFileNotFoundError);
    await expect(processStatement(missing)).rejects.toThrow('Input file not found.');
  });

  it('treats a directory as a missing input file', async () => {
    await expect(processStatement(FIXTURES)).rejects.toBeInstanceOf(InputFileNotFoundError);
  });

  it('rejects a file that is not a valid PDF with PdfExtractionError', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statement-bad-'));
    const fake = path.join(dir, 'fake.pdf');
    fs.writeFileSync(fake, 'this is plain text, not a PDF');
    await expect(processStatement(fake)).rejects.toBeInstanceOf(PdfExtractionError);
  });
});
