import { CategorizedTransaction, CategoryKeywords, Transaction } from './types';

export const UNCATEGORIZED = 'Uncategorized';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A keyword matches when it appears in the description starting at a word boundary
 * (case-insensitive). Anything may follow it, so "SAINSBURY" matches "SAINSBURYS",
 * but "TFL" does not match inside "NETFLIX" and "GAS" does not match inside "VEGAS".
 */
function keywordMatches(description: string, keyword: string): boolean {
  const needle = keyword.trim();
  if (needle.length === 0) {
    return false;
  }
  return new RegExp(`(?<![A-Z0-9])${escapeRegExp(needle)}`, 'i').test(description);
}

/**
 * Return the first category (in configuration order) with a keyword that matches the description,
 * or "Uncategorized" when nothing matches. Blank keywords are ignored.
 */
export function categorize(description: string, categoryKeywords: CategoryKeywords): string {
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => keywordMatches(description, keyword))) {
      return category;
    }
  }
  return UNCATEGORIZED;
}

export function categorizeTransactions(
  transactions: readonly Transaction[],
  categoryKeywords: CategoryKeywords,
): CategorizedTransaction[] {
  return transactions.map((transaction) => ({
    ...transaction,
    category: categorize(transaction.description, categoryKeywords),
  }));
}
