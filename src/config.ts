import * as fs from 'fs';
import * as path from 'path';
import { ConfigError } from './errors';
import { AppConfig, CategoryKeywords } from './types';

/** config.json lives in the repository root, one level above both `src/` and `dist/`. */
export const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '..', 'config.json');

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): AppConfig {
  let rawContent: string;
  try {
    rawContent = fs.readFileSync(configPath, 'utf8');
  } catch {
    throw new ConfigError(`cannot read configuration file at ${configPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new ConfigError(`${configPath} is not valid JSON`);
  }
  return { categoryKeywords: validateCategoryKeywords(parsed) };
}

function validateCategoryKeywords(parsed: unknown): CategoryKeywords {
  if (typeof parsed !== 'object' || parsed === null || !('categoryKeywords' in parsed)) {
    throw new ConfigError('"categoryKeywords" object is missing');
  }
  const candidate = (parsed as { categoryKeywords: unknown }).categoryKeywords;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new ConfigError('"categoryKeywords" must be an object');
  }

  const result: CategoryKeywords = {};
  for (const [category, keywords] of Object.entries(candidate)) {
    if (!Array.isArray(keywords) || keywords.some((keyword) => typeof keyword !== 'string')) {
      throw new ConfigError(`keywords for "${category}" must be an array of strings`);
    }
    result[category] = keywords as string[];
  }
  return result;
}
