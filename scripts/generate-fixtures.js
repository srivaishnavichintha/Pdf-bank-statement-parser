#!/usr/bin/env node
'use strict';

/**
 * Regenerates the PDF fixtures in tests/fixtures/.
 *
 * The script has no dependencies: it contains a tiny PDF writer that emits
 * valid, text-based PDF files (Courier, one text object per line) so that
 * `pdf-parse` can extract selectable text from them. All data is fictional.
 *
 * Usage: npm run fixtures
 */

const fs = require('fs');
const path = require('path');

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 50;
const TOP_Y = 790;
const LEADING = 13;
const LINES_PER_PAGE = 52;

/** Escape characters that have a special meaning inside PDF literal strings. */
function escapePdfString(text) {
  if (/[^\x20-\x7e]/.test(text)) {
    throw new Error(`Only printable ASCII is supported in fixtures: "${text}"`);
  }
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Build a PDF document.
 * Each entry of `lines` is either a string or `{ text, bold?, size? }`.
 * An empty string produces a blank row. Content is paginated automatically.
 */
function buildPdf(lines) {
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  // Object numbering: 1 catalog, 2 pages, 3 regular font, 4 bold font,
  // then (page, content stream) pairs.
  const FIRST_PAGE_OBJ = 5;
  const pageObjNumbers = pages.map((_, i) => FIRST_PAGE_OBJ + i * 2);
  const objects = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>';

  pages.forEach((pageLines, index) => {
    const pageObj = FIRST_PAGE_OBJ + index * 2;
    const contentObj = pageObj + 1;

    const commands = [];
    pageLines.forEach((line, row) => {
      const entry = typeof line === 'string' ? { text: line } : line;
      if (entry.text === '') return;
      const font = entry.bold ? 'F2' : 'F1';
      const size = entry.size || 10;
      const y = TOP_Y - row * LEADING;
      commands.push(
        `BT /${font} ${size} Tf 1 0 0 1 ${MARGIN_LEFT} ${y} Tm (${escapePdfString(entry.text)}) Tj ET`,
      );
    });
    const stream = commands.join('\n');

    objects[pageObj] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[contentObj] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });

  let output = '%PDF-1.4\n';
  const offsets = [];
  for (let n = 1; n < objects.length; n += 1) {
    offsets[n] = Buffer.byteLength(output, 'latin1');
    output += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += `xref\n0 ${objects.length}\n`;
  output += '0000000000 65535 f \n';
  for (let n = 1; n < objects.length; n += 1) {
    output += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(output, 'latin1');
}

// ---------------------------------------------------------------------------
// Fixture content (all data is fictional)
// ---------------------------------------------------------------------------

/** Format A: single-table layout, one transaction per row, signed amounts. */
function revolutStatement() {
  const rows = [
    ['01/10/2023', 'TESCO STORES', '-45.50'],
    ['03/10/2023', 'UBER TRIP', '-18.20'],
    ['05/10/2023', 'SALARY', '1500.00'],
    ['08/10/2023', 'NETFLIX', '-15.99'],
    ['09/10/2023', 'UNKNOWN COFFEE SHOP', '-4.50'],
    ['10/10/2023', 'SAINSBURYS SUPERMARKET', '-62.35'],
    ['12/10/2023', 'TFL TRAVEL CHARGE', '-25.00'],
    ['15/10/2023', 'BRITISH GAS', '-84.20'],
    ['17/10/2023', 'LIDL GB', '-27.40'],
    ['19/10/2023', 'THAMES WATER', '-31.00'],
    ['20/10/2023', 'TRANSFER FROM ALEX', '45.00'],
    ['22/10/2023', 'SPOTIFY PREMIUM', '-10.99'],
    ['24/10/2023', 'NORTHERN ELECTRIC', '-52.10'],
    ['27/10/2023', 'LOCAL BOOKSHOP', '-12.50'],
  ];

  return [
    { text: 'REVOLUT', bold: true, size: 16 },
    'Statement Period: 01/10/2023 - 31/10/2023',
    'Account Holder: Sample Customer',
    'Currency: GBP',
    '',
    `${'Date'.padEnd(12)}${'Description'.padEnd(26)}${'Amount'.padStart(10)}`,
    ...rows.map(([date, description, amount]) => `${date}  ${description.padEnd(26)}${amount.padStart(10)}`),
    '',
    'End of statement',
  ];
}

/** Format B: key/value blocks, separate "Money in" / "Money out" fields. */
function monzoStatement() {
  const blocks = [
    ['02/10/2023', 'ASDA SUPERMARKET', 'out', '72.40'],
    ['04/10/2023', 'TRAINLINE', 'out', '25.00'],
    ['06/10/2023', 'ALDI STORES', 'out', '38.15'],
    ['07/10/2023', 'SPOTIFY AB', 'out', '10.99'],
    ['09/10/2023', 'PRET A MANGER', 'out', '6.80'],
    ['10/10/2023', 'EMPLOYER SALARY', 'in', '1800.00'],
    ['12/10/2023', 'UBER TRIP', 'out', '14.60'],
    ['14/10/2023', 'SEVERN TRENT WATER', 'out', '28.50'],
    ['16/10/2023', 'NETFLIX.COM', 'out', '15.99'],
    ['18/10/2023', 'TESCO EXPRESS', 'out', '19.85'],
    ['20/10/2023', 'BRITISH GAS', 'out', '61.30'],
    ['23/10/2023', 'TFL TRAVEL', 'out', '12.40'],
    ['25/10/2023', 'FREELANCE INVOICE PAYMENT', 'in', '250.00'],
    ['28/10/2023', 'CORNER BOOKSHOP', 'out', '18.00'],
  ];

  const lines = [
    { text: 'MONZO BANK', bold: true, size: 16 },
    'Account Statement',
    'Period: 01 Oct 2023 to 31 Oct 2023',
    '',
  ];
  for (const [date, merchant, direction, amount] of blocks) {
    lines.push(`Date: ${date}`);
    lines.push(`Merchant: ${merchant}`);
    lines.push(direction === 'in' ? `Money in: ${amount}` : `Money out: ${amount}`);
    lines.push('');
  }
  lines.push('End of statement');
  return lines;
}

/** A PDF that is not a supported bank statement. */
function unsupportedDocument() {
  return [
    { text: 'NORTHWIND LEISURE CLUB', bold: true, size: 16 },
    'Membership Invoice #20231',
    '',
    'Annual membership fee            120.00',
    'Locker rental                     15.00',
    'Total due                        135.00',
    '',
    'Thank you for being a member.',
  ];
}

function main() {
  const outDir = path.resolve(__dirname, '..', 'tests', 'fixtures');
  fs.mkdirSync(outDir, { recursive: true });

  const fixtures = {
    'statement_format_a.pdf': revolutStatement(),
    'statement_format_b.pdf': monzoStatement(),
    'unsupported.pdf': unsupportedDocument(),
  };

  for (const [fileName, lines] of Object.entries(fixtures)) {
    const target = path.join(outDir, fileName);
    fs.writeFileSync(target, buildPdf(lines));
    process.stdout.write(`Wrote ${path.relative(process.cwd(), target)}\n`);
  }
}

main();
