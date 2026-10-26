import { formatPeriod, summarize } from '../src/summary';
import { CategorizedTransaction, StatementPeriod } from '../src/types';

const period: StatementPeriod = { start: '2023-10-01', end: '2023-10-31' };

function tx(category: string, amount: number): CategorizedTransaction {
  return { date: '2023-10-10', description: `${category} item`, amount, category };
}

describe('formatPeriod', () => {
  it('joins the ISO dates with _to_', () => {
    expect(formatPeriod(period)).toBe('2023-10-01_to_2023-10-31');
  });
});

describe('summarize', () => {
  it('computes the example from the specification', () => {
    const result = summarize(
      [tx('Groceries', -50), tx('Transport', -20), tx('Uncategorized', 1500)],
      period,
    );
    expect(result).toEqual({
      period: '2023-10-01_to_2023-10-31',
      summary: { Groceries: -50, Transport: -20 },
      totalExpenses: -70,
      totalIncome: 1500,
    });
  });

  it('sums several transactions per category and keeps the sign', () => {
    const result = summarize([tx('Groceries', -45.5), tx('Groceries', -62.35), tx('Groceries', -27.4)], period);
    expect(result.summary).toEqual({ Groceries: -135.25 });
    expect(result.totalExpenses).toBe(-135.25);
    expect(result.totalIncome).toBe(0);
  });

  it('avoids floating point drift', () => {
    const result = summarize([tx('A', -0.1), tx('A', -0.2), tx('B', 0.1), tx('B', 0.2)], period);
    expect(result.summary).toEqual({ A: -0.3 });
    expect(result.totalExpenses).toBe(-0.3);
    expect(result.totalIncome).toBe(0.3);
  });

  it('sums many small amounts exactly', () => {
    const transactions = Array.from({ length: 100 }, () => tx('Coffee', -0.07));
    const result = summarize(transactions, period);
    expect(result.summary).toEqual({ Coffee: -7 });
    expect(result.totalExpenses).toBe(-7);
  });

  it('counts positive amounts as income only, even when categorised', () => {
    const result = summarize([tx('Groceries', -10), tx('Groceries', 4), tx('Uncategorized', 100)], period);
    expect(result.summary).toEqual({ Groceries: -10 });
    expect(result.totalExpenses).toBe(-10);
    expect(result.totalIncome).toBe(104);
  });

  it('lists Uncategorized last and keeps first-seen order for the rest', () => {
    const result = summarize(
      [tx('Uncategorized', -1), tx('Transport', -2), tx('Groceries', -3), tx('Transport', -4)],
      period,
    );
    expect(Object.keys(result.summary)).toEqual(['Transport', 'Groceries', 'Uncategorized']);
  });

  it('returns zero totals for an empty transaction list', () => {
    const result = summarize([], period);
    expect(result).toEqual({
      period: '2023-10-01_to_2023-10-31',
      summary: {},
      totalExpenses: 0,
      totalIncome: 0,
    });
  });

  it('ignores zero amounts and never produces negative zero', () => {
    const result = summarize([tx('Groceries', 0)], period);
    expect(result.summary).toEqual({});
    expect(Object.is(result.totalExpenses, 0)).toBe(true);
    expect(Object.is(result.totalIncome, 0)).toBe(true);
  });

  it('serialises to clean JSON numbers', () => {
    const result = summarize([tx('Groceries', -45.5), tx('Groceries', -0.1), tx('Groceries', -0.2)], period);
    expect(JSON.stringify(result.summary)).toBe('{"Groceries":-45.8}');
  });
});
