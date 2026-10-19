export function splitTextIntoChunks(text, chunkSize, overlap) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
