import { hashContent } from '../utils/crypto.js';

/** Hash covers title, body, and image so edits invalidate approval. */
export function computePostContentHash({ topic, content, imageStorageKey }) {
  return hashContent([topic || '', content || '', imageStorageKey || ''].join('\n---\n'));
}
