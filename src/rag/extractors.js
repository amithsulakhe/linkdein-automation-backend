import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractTextFromFile(filePath, mimeType) {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return fs.readFile(filePath, 'utf8');
  }
  if (mimeType === 'application/pdf') {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
