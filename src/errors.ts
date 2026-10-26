/**
 * Base class for every error the application raises on purpose.
 * The CLI prints `message` (and optional `detail`) to stderr and exits with `exitCode`.
 */
export class StatementError extends Error {
  readonly exitCode: number;
  readonly detail?: string;

  constructor(message: string, options: { exitCode?: number; detail?: string } = {}) {
    super(message);
    this.name = new.target.name;
    this.exitCode = options.exitCode ?? 1;
    this.detail = options.detail;
  }
}

export class UsageError extends StatementError {
  constructor(message: string, detail?: string) {
    super(message, { exitCode: 2, detail });
  }
}

export class InputFileNotFoundError extends StatementError {
  constructor(filePath: string) {
    super('Input file not found.', { detail: `Path: ${filePath}` });
  }
}

export class PdfExtractionError extends StatementError {
  constructor(filePath: string, cause?: unknown) {
    const reason = cause instanceof Error ? cause.message : undefined;
    super('Unable to extract text from the PDF.', {
      detail: reason ? `Path: ${filePath} (${reason})` : `Path: ${filePath}`,
    });
  }
}

export class UnsupportedStatementFormatError extends StatementError {
  constructor(supportedBanks: readonly string[] = []) {
    super('Unsupported statement format.', {
      detail: supportedBanks.length > 0 ? `Supported formats: ${supportedBanks.join(', ')}` : undefined,
    });
  }
}

/** The statement was recognised but its content could not be parsed reliably. */
export class StatementParseError extends StatementError {
  constructor(message: string) {
    super(`Unable to parse statement: ${message}`);
  }
}

export class ConfigError extends StatementError {
  constructor(message: string) {
    super(`Invalid configuration: ${message}`);
  }
}
