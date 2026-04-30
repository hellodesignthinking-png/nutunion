// Ambient declarations for pdf-parse — package ships no types.
declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseFn = (data: Buffer | Uint8Array, options?: { max?: number; pagerender?: unknown; version?: string }) => Promise<{
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }>;
  const pdfParse: PdfParseFn;
  export default pdfParse;
}

declare module "pdf-parse" {
  import pdfParse from "pdf-parse/lib/pdf-parse.js";
  export default pdfParse;
}
