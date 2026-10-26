/** A single parsed statement line. Debits are negative, credits are positive. */
export interface Transaction {
  /** ISO 8601 calendar date (YYYY-MM-DD). */
  date: string;
  description: string;
  /** Signed amount in the statement currency (negative = money out). */
  amount: number;
}

/** Inclusive statement period as ISO 8601 calendar dates. */
export interface StatementPeriod {
  start: string;
  end: string;
}

/** Category name -> list of case-insensitive keywords. */
export type CategoryKeywords = Record<string, string[]>;

/** Shape of config.json. */
export interface AppConfig {
  categoryKeywords: CategoryKeywords;
}

export interface CategorizedTransaction extends Transaction {
  category: string;
}

/** The JSON document printed by the CLI. */
export interface StatementSummary {
  /** `YYYY-MM-DD_to_YYYY-MM-DD` */
  period: string;
  /** Spending (negative totals) per category. */
  summary: Record<string, number>;
  totalExpenses: number;
  totalIncome: number;
}
