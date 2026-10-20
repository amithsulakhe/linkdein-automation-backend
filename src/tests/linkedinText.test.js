import { describe, expect, it } from 'vitest';
import { toLinkedInCommentary } from '../utils/plainPostText.js';

describe('toLinkedInCommentary', () => {
  it('escapes parentheses and keeps the rest of the post', () => {
    const input =
      "refers to the global object (or undefined in strict mode).\n\n#JavaScript #thisKeyword";
    expect(toLinkedInCommentary(input)).toBe(
      'refers to the global object \\(or undefined in strict mode\\).\n\n#JavaScript #thisKeyword'
    );
  });
});
