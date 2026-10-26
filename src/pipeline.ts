import { categorizeTransactions } from './categorizer';
import { loadConfig } from './config';
import { extractText } from './pdfExtractor';
import { StatementParserFactory } from './parsers/StatementParserFactory';
import { summarize } from './summary';
import { AppConfig, StatementSummary } from './types';

/** Text -> parser (via the factory) -> transactions -> categories -> summary. */
export function analyzeStatementText(rawText: string, config: AppConfig): StatementSummary {
  const parser = StatementParserFactory.getParser(rawText);
  const period = parser.getPeriod(rawText);
  const transactions = parser.parse(rawText);
  const categorized = categorizeTransactions(transactions, config.categoryKeywords);
  return summarize(categorized, period);
}

/** The complete workflow used by the CLI: PDF file -> summary. */
export async function processStatement(
  filePath: string,
  options: { configPath?: string } = {},
): Promise<StatementSummary> {
  const rawText = await extractText(filePath);
  const config = loadConfig(options.configPath);
  return analyzeStatementText(rawText, config);
}
