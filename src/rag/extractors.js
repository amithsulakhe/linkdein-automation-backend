import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractTextFromFile(filePath, mimeType) {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return { text: await fs.readFile(filePath, 'utf8'), pageCount: 1 };
  }
  if (mimeType === 'application/pdf') {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return { text: data.text || '', pageCount: data.numpages || 0 };
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value || '', pageCount: null };
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
