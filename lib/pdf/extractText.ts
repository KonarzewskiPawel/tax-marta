import {PDFParse} from "pdf-parse";

export interface PdfExtraction {
  text: string;
  numPages: number;
}

export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<PdfExtraction> {
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  try {
    const result = await parser.getText();
    return {
      text: result.text || "",
      numPages: result.total,
    };
  } finally {
    await parser.destroy();
  }
}
