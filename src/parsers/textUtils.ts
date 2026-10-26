const HEADER_LINE_COUNT = 5;

export function splitLines(rawText: string): string[] {
  return rawText.split(/\r?\n/).map((line) => line.trim());
}

/**
 * True when one of the first few non-empty lines (the statement header) matches the pattern.
 * Looking only at the header keeps a merchant such as "TRANSFER TO REVOLUT" from
 * making a Monzo statement look like a Revolut one.
 */
export function headerMatches(rawText: string, pattern: RegExp): boolean {
  return splitLines(rawText)
    .filter((line) => line.length > 0)
    .slice(0, HEADER_LINE_COUNT)
    .some((line) => pattern.test(line));
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
