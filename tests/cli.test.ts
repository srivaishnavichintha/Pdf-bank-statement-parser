import { spawnSync, SpawnSyncReturns } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'dist', 'index.js');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');

function runCli(...args: string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
}

beforeAll(() => {
  // Build the real CLI so these tests exercise exactly what `node dist/index.js` runs.
  const tsc = require.resolve('typescript/bin/tsc');
  const build = spawnSync(process.execPath, [tsc, '-p', path.join(ROOT, 'tsconfig.json')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    throw new Error(`TypeScript build failed:\n${build.stdout}${build.stderr}`);
  }
  expect(fs.existsSync(CLI)).toBe(true);
}, 120000);

describe('CLI', () => {
  it('prints only valid JSON to stdout for format A and exits with 0', () => {
    const result = runCli('tests/fixtures/statement_format_a.pdf');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const output = JSON.parse(result.stdout);
    expect(output.period).toBe('2023-10-01_to_2023-10-31');
    expect(output.totalExpenses).toBe(-389.73);
    expect(output.totalIncome).toBe(1545);
    expect(output.summary.Groceries).toBe(-135.25);
  });

  it('prints only valid JSON to stdout for format B and exits with 0', () => {
    const result = runCli(path.join(FIXTURES, 'statement_format_b.pdf'));
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const output = JSON.parse(result.stdout);
    expect(output.period).toBe('2023-10-01_to_2023-10-31');
    expect(output.totalExpenses).toBe(-323.98);
    expect(output.totalIncome).toBe(2050);
    expect(output.summary.Utilities).toBe(-89.8);
  });

  it('reports a missing input file on stderr with a non-zero exit code', () => {
    const result = runCli('does-not-exist.pdf');
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Error: Input file not found.');
  });

  it('reports an unsupported statement on stderr with a non-zero exit code', () => {
    const result = runCli('tests/fixtures/unsupported.pdf');
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Error: Unsupported statement format.');
  });

  it('prints usage and exits non-zero when no file is given', () => {
    const result = runCli();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Usage:');
  });

  it('rejects unknown options and extra arguments', () => {
    expect(runCli('--bogus').status).not.toBe(0);
    expect(runCli('a.pdf', 'b.pdf').status).not.toBe(0);
    expect(runCli('tests/fixtures/statement_format_a.pdf', '--config').status).not.toBe(0);
  });

  it('prints usage to stdout and exits 0 for --help', () => {
    const result = runCli('--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
  });

  it('reports an unreadable configuration file as an error', () => {
    const result = runCli('tests/fixtures/statement_format_a.pdf', '--config', 'missing-config.json');
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Error: Invalid configuration');
  });
});
