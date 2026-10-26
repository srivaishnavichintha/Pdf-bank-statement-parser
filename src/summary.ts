import { UNCATEGORIZED } from './categorizer';
import { amountToCents, centsToAmount } from './money';
import { CategorizedTransaction, StatementPeriod, StatementSummary } from './types';

export function formatPeriod(period: StatementPeriod): string {
  return `${period.start}_to_${period.end}`;
}

/**
 * Build the final report.
 *
 * - `summary` holds spending only (negative amounts), grouped by category, sign preserved.
 * - `totalExpenses` is the sum of all negative amounts, `totalIncome` the sum of all positive ones.
 * - Sums are computed in integer cents, so results are free of floating-point artefacts.
 */
export function summarize(
  transactions: readonly CategorizedTransaction[],
  period: StatementPeriod,
): StatementSummary {
  const categoryCents = new Map<string, number>();
  let expensesCents = 0;
  let incomeCents = 0;

  for (const transaction of transactions) {
    const cents = amountToCents(transaction.amount);
    if (cents < 0) {
      expensesCents += cents;
      categoryCents.set(transaction.category, (categoryCents.get(transaction.category) ?? 0) + cents);
    } else if (cents > 0) {
      incomeCents += cents;
    }
  }

  // Keep first-seen category order, but always list "Uncategorized" last.
  const categories = [...categoryCents.keys()].sort(
    (a, b) => Number(a === UNCATEGORIZED) - Number(b === UNCATEGORIZED),
  );
  const summary: Record<string, number> = {};
  for (const category of categories) {
    summary[category] = centsToAmount(categoryCents.get(category) ?? 0);
  }

  return {
    period: formatPeriod(period),
    summary,
    totalExpenses: centsToAmount(expensesCents),
    totalIncome: centsToAmount(incomeCents),
  };
}
