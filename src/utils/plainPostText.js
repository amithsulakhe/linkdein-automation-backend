export function toPlainLinkedInText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** LinkedIn treats these as formatting and drops the rest of the post unless they are escaped. */
const LINKEDIN_RESERVED = /[\\()[\]{}<>|@*_~#]/g;

export function toLinkedInCommentary(text) {
  const source = String(text || '');
  const hashtags = [];
  const shielded = source.replace(/(^|[\s])(#[\p{L}\p{N}_]+)/gu, (_match, lead, tag) => {
    const token = `⟦H${hashtags.length}⟧`;
    hashtags.push(tag);
    return `${lead}${token}`;
  });
  const escaped = shielded.replace(LINKEDIN_RESERVED, (ch) => `\\${ch}`);
  return escaped.replace(/⟦H(\d+)⟧/g, (_match, index) => hashtags[Number(index)]);
}

export function formatDisplayDate(value, timeZone = 'Asia/Kolkata') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
