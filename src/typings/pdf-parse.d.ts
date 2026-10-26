/**
 * Minimal typings for the part of pdf-parse 1.x that this project uses.
 *
 * The deep import avoids the package's index.js, which runs a debug routine
 * (reading a bundled test PDF) when `module.parent` is not set, as happens under Jest.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PdfParseResult>;
  export = pdfParse;
}
