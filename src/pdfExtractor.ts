/// <reference path="./typings/pdf-parse.d.ts" />
import * as fs from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { InputFileNotFoundError, PdfExtractionError } from './errors';

/** Read a PDF from disk and return its extracted text. */
export async function extractText(filePath: string): Promise<string> {
  let buffer: Buffer;
  try {
    if (!fs.statSync(filePath).isFile()) {
      throw new InputFileNotFoundError(filePath);
    }
    buffer = fs.readFileSync(filePath);
  } catch (error) {
    if (error instanceof InputFileNotFoundError) {
      throw error;
    }
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new InputFileNotFoundError(filePath);
    }
    throw new PdfExtractionError(filePath, error);
  }

  try {
    // pdf.js (inside pdf-parse 1.x) assumes the bytes start at offset 0 of their ArrayBuffer.
    // Node serves small files (< 4 KB) from a shared memory pool, which breaks that assumption
    // ("bad XRef entry"), so hand it a standalone copy.
    const result = await pdfParse(new Uint8Array(buffer));
    return result.text;
  } catch (error) {
    throw new PdfExtractionError(filePath, error);
  }
}
