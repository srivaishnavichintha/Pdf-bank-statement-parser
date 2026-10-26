#!/usr/bin/env node
import { StatementError, UsageError } from './errors';
import { processStatement } from './pipeline';

const USAGE = 'Usage: node dist/index.js <statement.pdf> [--config <config.json>]';

interface CliArguments {
  filePath?: string;
  configPath?: string;
  help: boolean;
}

function parseArguments(argv: readonly string[]): CliArguments {
  const result: CliArguments = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '-h' || argument === '--help') {
      result.help = true;
    } else if (argument === '--config') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new UsageError('Missing value for --config.', USAGE);
      }
      result.configPath = value;
      index += 1;
    } else if (argument.startsWith('-')) {
      throw new UsageError(`Unknown option: ${argument}`, USAGE);
    } else if (result.filePath === undefined) {
      result.filePath = argument;
    } else {
      throw new UsageError('Only one input file may be given.', USAGE);
    }
  }
  return result;
}

async function main(argv: readonly string[]): Promise<number> {
  try {
    const args = parseArguments(argv);
    if (args.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    if (args.filePath === undefined) {
      throw new UsageError('No input file given.', USAGE);
    }

    const result = await processStatement(args.filePath, { configPath: args.configPath });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof StatementError) {
      process.stderr.write(`Error: ${error.message}\n`);
      if (error.detail) {
        process.stderr.write(`${error.detail}\n`);
      }
      return error.exitCode;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: Unexpected failure: ${message}\n`);
    return 1;
  }
}

main(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
