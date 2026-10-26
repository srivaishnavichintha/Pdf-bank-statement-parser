# PDF Bank Statement Parser

A command-line tool that reads a PDF bank statement, detects which bank layout it uses, parses the transactions, categorizes them with keywords from `config.json`, and prints a JSON summary to stdout.

Built with Node.js, TypeScript, [`pdf-parse`](https://www.npmjs.com/package/pdf-parse), Jest and ts-jest. Parser selection uses the **Factory Design Pattern**.

## Table of contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Factory Pattern](#factory-pattern)
4. [Supported statement formats](#supported-statement-formats)
5. [Project structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Installation](#installation)
8. [Build](#build)
9. [Usage](#usage)
10. [Example output](#example-output)
11. [Configuration](#configuration)
12. [Testing](#testing)
13. [Error handling](#error-handling)
14. [Adding another bank parser](#adding-another-bank-parser)
15. [Design decisions](#design-decisions)
16. [Limitations](#limitations)

## Features

- Extracts selectable text from PDF statements with `pdf-parse`.
- Detects the statement format automatically (Revolut-style table, Monzo-style key/value blocks).
- Normalises dates to ISO `YYYY-MM-DD` and amounts to signed numbers (negative = money out).
- Keyword-based, case-insensitive categorization driven entirely by `config.json`.
- Reports the statement period, spending per category, total expenses and total income.
- Prints **only** JSON to stdout on success; errors go to stderr with a non-zero exit code.
- Money is summed in integer cents, so there is no floating-point drift.
- Unit tests, integration tests on real PDF fixtures, and CLI end-to-end tests.

## Architecture

```
PDF file
  │  pdfExtractor.ts      (pdf-parse → raw text)
  ▼
StatementParserFactory    (inspects the text, returns an IStatementParser)
  │
  ├── RevolutParser ─┐
  └── MonzoParser  ──┴─►  Transaction[] + StatementPeriod
                              │  categorizer.ts   (config.json keywords)
                              ▼
                          CategorizedTransaction[]
                              │  summary.ts
                              ▼
                          JSON summary → stdout
```

`pipeline.ts` wires these steps together; `index.ts` is only the command-line shell around it (argument parsing, printing, exit codes).

## Factory Pattern

| Role | Code |
| --- | --- |
| Product interface | `IStatementParser` (`src/parsers/IStatementParser.ts`) with `parse(rawText)` and `getPeriod(rawText)` |
| Concrete products | `RevolutParser`, `MonzoParser` |
| Factory | `StatementParserFactory.getParser(rawText)` (`src/parsers/StatementParserFactory.ts`) |
| Client | `pipeline.ts` / `index.ts`, which depend only on the factory and the interface |

The factory inspects the extracted text and returns the matching parser:

```
REVOLUT       → RevolutParser
MONZO         → MonzoParser
anything else → throws UnsupportedStatementFormatError
```

```ts
const parser = StatementParserFactory.getParser(rawText); // IStatementParser
const transactions = parser.parse(rawText);
const period = parser.getPeriod(rawText);
```

No bank-specific logic exists outside `src/parsers/`, and the CLI never instantiates a concrete parser. Detection looks only at the statement header (the first five non-empty lines), so a transaction such as `TRANSFER TO REVOLUT` on a Monzo statement cannot cause a misdetection.

## Supported statement formats

Both banks are fictional stand-ins for the purpose of this exercise, and all fixture data is made up.

**Format A: Revolut-style** (one table row per transaction, signed amounts)

```text
REVOLUT
Statement Period: 01/10/2023 - 31/10/2023

Date        Description                 Amount
01/10/2023  TESCO STORES              -45.50
05/10/2023  SALARY                   1500.00
```

**Format B: Monzo-style** (one key/value block per transaction, separate `Money in` / `Money out` fields)

```text
MONZO BANK
Account Statement
Period: 01 Oct 2023 to 31 Oct 2023

Date: 02/10/2023
Merchant: ASDA SUPERMARKET
Money out: 72.40

Date: 10/10/2023
Merchant: EMPLOYER SALARY
Money in: 1800.00
```

## Project structure

```
pdf-bank-statement-parser/
├── src/
│   ├── index.ts              CLI entry point (args, stdout/stderr, exit codes)
│   ├── pipeline.ts           PDF → factory → parser → categorizer → summary
│   ├── pdfExtractor.ts       Reads the PDF and extracts text with pdf-parse
│   ├── categorizer.ts        Keyword categorization
│   ├── summary.ts            Period, category totals, expenses, income
│   ├── config.ts             Loads and validates config.json
│   ├── errors.ts             Custom error classes
│   ├── money.ts              Amount parsing, integer-cent helpers
│   ├── dates.ts              Date parsing/validation → ISO
│   ├── types.ts              Shared interfaces
│   ├── typings/pdf-parse.d.ts
│   └── parsers/
│       ├── IStatementParser.ts
│       ├── RevolutParser.ts
│       ├── MonzoParser.ts
│       ├── StatementParserFactory.ts
│       └── textUtils.ts
├── tests/
│   ├── fixtures/
│   │   ├── statement_format_a.pdf
│   │   ├── statement_format_b.pdf
│   │   └── unsupported.pdf
│   ├── categorizer.test.ts
│   ├── summary.test.ts
│   ├── utils.test.ts         money, dates, config
│   ├── factory.test.ts
│   ├── parsers.test.ts
│   ├── integration.test.ts   real PDFs through the full pipeline
│   └── cli.test.ts           spawns the compiled CLI
├── scripts/generate-fixtures.js   Regenerates the PDF fixtures (no dependencies)
├── config.json
├── package.json
├── tsconfig.json             build (src only → dist/)
├── tsconfig.test.json        used by ts-jest (src + tests)
├── jest.config.js
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 18 or newer
- npm

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

This compiles `src/` to `dist/`.

## Usage

```bash
node dist/index.js <statement.pdf> [--config <config.json>]
```

Examples:

```bash
node dist/index.js tests/fixtures/statement_format_a.pdf
node dist/index.js tests/fixtures/statement_format_b.pdf
node dist/index.js tests/fixtures/unsupported.pdf   # error on stderr, exit code 1
node dist/index.js does-not-exist.pdf               # error on stderr, exit code 1
node dist/index.js --help
```

`npm start -- <statement.pdf>` is equivalent to `node dist/index.js <statement.pdf>`.

Exit codes: `0` success, `1` runtime error (missing file, unsupported or unparsable statement, bad config), `2` usage error (missing or unknown arguments).

## Example output

`node dist/index.js tests/fixtures/statement_format_a.pdf`

```json
{
  "period": "2023-10-01_to_2023-10-31",
  "summary": {
    "Groceries": -135.25,
    "Transport": -43.2,
    "Entertainment": -26.98,
    "Utilities": -167.3,
    "Uncategorized": -17
  },
  "totalExpenses": -389.73,
  "totalIncome": 1545
}
```

`node dist/index.js tests/fixtures/statement_format_b.pdf`

```json
{
  "period": "2023-10-01_to_2023-10-31",
  "summary": {
    "Groceries": -130.4,
    "Transport": -52,
    "Entertainment": -26.98,
    "Utilities": -89.8,
    "Uncategorized": -24.8
  },
  "totalExpenses": -323.98,
  "totalIncome": 2050
}
```

## Configuration

Categories live in `config.json` at the repository root; nothing is hard-coded in the categorizer.

```json
{
  "categoryKeywords": {
    "Groceries": ["TESCO", "ASDA", "SAINSBURY", "LIDL", "ALDI", "MORRISONS", "WAITROSE"],
    "Transport": ["UBER", "TFL", "TRAINLINE", "NATIONAL RAIL"],
    "Entertainment": ["NETFLIX", "SPOTIFY", "DISNEY", "CINEMA"],
    "Utilities": ["ELECTRIC", "WATER", "GAS", "BROADBAND"]
  }
}
```

Matching rules:

- Case-insensitive: `Tesco Stores` → Groceries.
- A keyword matches where it starts at a word boundary, and anything may follow it. `SAINSBURY` matches `SAINSBURYS`, but `TFL` does **not** match inside `NETFLIX`, and `GAS` does not match inside `VEGAS`.
- If several categories match, the first one in the file wins.
- No match → `Uncategorized`. Blank keywords are ignored.

Use a different file with `--config path/to/config.json`.

## Testing

```bash
npm test                # jest --runInBand
npm run test:coverage   # with coverage report
```

- **Unit tests:** categorization (keywords, case-insensitivity, fallback, precedence), summary maths, money/date parsing, config validation, factory behaviour, and parser behaviour including malformed input.
- **Integration tests** (`tests/integration.test.ts`): the real `pdf-parse` reads the real PDF fixtures and the whole pipeline runs, asserting the exact expected JSON for both formats, plus the unsupported-PDF and missing-file failures. Nothing is mocked.
- **CLI tests** (`tests/cli.test.ts`): build the project, spawn `node dist/index.js`, and check stdout is valid JSON with exit code 0 on success, and that errors go to stderr with a non-zero exit code.

Regenerate the fixtures (deterministic output) with:

```bash
npm run fixtures
```

## Error handling

| Situation | stderr | Exit code |
| --- | --- | --- |
| Input file missing (or a directory) | `Error: Input file not found.` | 1 |
| PDF exists but is not a supported format | `Error: Unsupported statement format.` | 1 |
| File is not a readable PDF | `Error: Unable to extract text from the PDF.` | 1 |
| Recognised format but malformed content | `Error: Unable to parse statement: …` | 1 |
| Bad or missing `config.json` | `Error: Invalid configuration: …` | 1 |
| Missing/unknown CLI arguments | `Error: …` plus a usage line | 2 |

Errors are subclasses of `StatementError` (`src/errors.ts`). stdout stays empty on failure, so it is always either valid JSON or nothing.

## Adding another bank parser

1. Create `src/parsers/MyBankParser.ts` implementing `IStatementParser` with `parse` and `getPeriod`, plus a static `supports(rawText)` that recognises the header.
2. Add one entry to `REGISTRATIONS` in `src/parsers/StatementParserFactory.ts`:

   ```ts
   { bankName: 'MyBank', supports: (t) => MyBankParser.supports(t), create: () => new MyBankParser() },
   ```
3. Add a fixture (extend `scripts/generate-fixtures.js`) and tests.

The CLI, categorizer and summary need no changes.

## Design decisions

- **Integer cents for arithmetic.** Amounts are parsed to cents, summed as integers and divided by 100 only at the end, so `0.1 + 0.2` style errors cannot appear.
- **`summary` contains spending only.** Category totals include negative transactions only, so they always add up to `totalExpenses`. Positive amounts (salary, refunds, transfers in) count towards `totalIncome`.
- **Fail loudly on malformed rows.** A row that starts with a date but cannot be parsed, or a Monzo block with a missing field, raises `StatementParseError` rather than silently dropping money. A statement with no transactions at all is also treated as an error.
- **Header-based detection.** Only the first non-empty lines are inspected, which avoids false positives from transaction text.
- **Registry in the factory.** Adding a bank is a one-line change in one file.
- **Deep import of pdf-parse.** The code imports `pdf-parse/lib/pdf-parse.js` because the package's `index.js` runs a debug routine that tries to read a bundled test file when `module.parent` is unset, which happens under Jest.
- **Dependency-free fixture generator.** `scripts/generate-fixtures.js` writes minimal valid PDFs (one text object per line, Courier font), so no PDF library is needed in the dependency tree.
- **Config read at runtime.** `config.json` is read with `fs` relative to the compiled/source file, keeping `dist/` layout simple.

## Limitations

- Only text-based PDFs are supported; scanned statements need OCR first.
- Parsers are tuned to the two fictional layouts above. Real bank statements differ and would need their own parsers.
- Detection relies on the bank name appearing in the first five non-empty lines.
- Keyword matching is a simple word-start test: `WATER` would also match `WATERSTONES`, and the first matching category wins.
- A single currency is assumed; amounts are reported as plain numbers without a currency code.
- Dates are `DD/MM/YYYY` (and `DD Mon YYYY` for the Monzo period); US-style dates are not handled.
- Statements without any transactions are rejected rather than reported as empty.
