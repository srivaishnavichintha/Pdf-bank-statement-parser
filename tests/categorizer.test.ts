import { categorize, categorizeTransactions, UNCATEGORIZED } from '../src/categorizer';
import { loadConfig } from '../src/config';
import { CategoryKeywords } from '../src/types';

const keywords: CategoryKeywords = {
  Groceries: ['TESCO', 'ASDA', 'SAINSBURY', 'LIDL', 'ALDI'],
  Transport: ['UBER', 'TFL', 'TRAINLINE'],
  Entertainment: ['NETFLIX', 'SPOTIFY'],
  Utilities: ['ELECTRIC', 'WATER', 'GAS'],
};

describe('categorize', () => {
  it('maps keywords to their category', () => {
    expect(categorize('TESCO', keywords)).toBe('Groceries');
    expect(categorize('UBER TRIP', keywords)).toBe('Transport');
    expect(categorize('NETFLIX', keywords)).toBe('Entertainment');
    expect(categorize('BRITISH GAS', keywords)).toBe('Utilities');
  });

  it('matches case-insensitively', () => {
    expect(categorize('tesco stores', keywords)).toBe('Groceries');
    expect(categorize('Tesco Stores', keywords)).toBe('Groceries');
    expect(categorize('Netflix Subscription', keywords)).toBe('Entertainment');
  });

  it('is case-insensitive for keywords written in lower case in the config', () => {
    expect(categorize('TESCO STORES', { Groceries: ['tesco'] })).toBe('Groceries');
  });

  it('falls back to Uncategorized', () => {
    expect(categorize('Unknown Coffee Shop', keywords)).toBe(UNCATEGORIZED);
    expect(categorize('unknown merchant', keywords)).toBe('Uncategorized');
    expect(categorize('', keywords)).toBe('Uncategorized');
  });

  it('supports several keywords per category', () => {
    expect(categorize('ASDA SUPERMARKET', keywords)).toBe('Groceries');
    expect(categorize('LIDL GB', keywords)).toBe('Groceries');
    expect(categorize('SAINSBURYS SUPERMARKET', keywords)).toBe('Groceries');
  });

  it('matches keywords at the start of a word, not in the middle of one', () => {
    // "TFL" is hidden inside NETFLIX, "GAS" inside VEGAS: neither may match.
    expect(categorize('NETFLIX', keywords)).toBe('Entertainment');
    expect(categorize('VEGAS CASINO', keywords)).toBe('Uncategorized');
    expect(categorize('TFL.GOV.UK TRAVEL', keywords)).toBe('Transport');
  });

  it('returns the first matching category in configuration order', () => {
    const ordered: CategoryKeywords = { First: ['SHOP'], Second: ['SHOP'] };
    expect(categorize('LOCAL SHOP', ordered)).toBe('First');
  });

  it('handles multi-word and special-character keywords literally', () => {
    const special: CategoryKeywords = { Transport: ['NATIONAL RAIL', 'A.B'], Other: ['(X)'] };
    expect(categorize('NATIONAL RAIL TICKET', special)).toBe('Transport');
    expect(categorize('A.B PAYMENT', special)).toBe('Transport');
    expect(categorize('AXB PAYMENT', special)).toBe('Uncategorized');
    expect(categorize('PAY (X) NOW', special)).toBe('Other');
  });

  it('ignores blank keywords instead of matching everything', () => {
    expect(categorize('ANYTHING', { Broken: ['', '   '] })).toBe('Uncategorized');
  });

  it('works with an empty configuration', () => {
    expect(categorize('TESCO', {})).toBe('Uncategorized');
  });
});

describe('categorizeTransactions', () => {
  it('adds a category to every transaction without mutating the input', () => {
    const input = [
      { date: '2023-10-01', description: 'TESCO STORES', amount: -45.5 },
      { date: '2023-10-05', description: 'SALARY', amount: 1500 },
    ];
    const result = categorizeTransactions(input, keywords);

    expect(result).toEqual([
      { date: '2023-10-01', description: 'TESCO STORES', amount: -45.5, category: 'Groceries' },
      { date: '2023-10-05', description: 'SALARY', amount: 1500, category: 'Uncategorized' },
    ]);
    expect(input[0]).toEqual({ date: '2023-10-01', description: 'TESCO STORES', amount: -45.5 });
  });
});

describe('config.json categorisation', () => {
  it('reads the categories from the repository config instead of hard-coding them', () => {
    const config = loadConfig();
    expect(categorize('Tesco Stores', config.categoryKeywords)).toBe('Groceries');
    expect(categorize('UBER TRIP', config.categoryKeywords)).toBe('Transport');
    expect(categorize('Netflix Subscription', config.categoryKeywords)).toBe('Entertainment');
    expect(categorize('NORTHERN ELECTRIC', config.categoryKeywords)).toBe('Utilities');
    expect(categorize('Unknown Coffee Shop', config.categoryKeywords)).toBe('Uncategorized');
  });
});
