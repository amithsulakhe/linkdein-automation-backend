import { describe, it, expect } from 'vitest';

describe('Asia/Kolkata daily job key', () => {
  it('formats stable date keys in IST', async () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const key = formatter.format(new Date('2026-10-18T04:30:00.000Z'));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
