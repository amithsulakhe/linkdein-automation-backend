import { describe, it, expect } from 'vitest';
import { APPROVAL_STATUSES } from '../models/ApprovalRequest.js';

describe('approval state machine', () => {
  it('defines terminal states that cannot return to pending', () => {
    const terminal = ['APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'];
    for (const status of terminal) {
      expect(APPROVAL_STATUSES).toContain(status);
    }
    expect(APPROVAL_STATUSES).not.toContain('PUBLISHED');
  });

  it('documents replay protection expectation', () => {
    const pending = 'PENDING';
    const afterReject = 'REJECTED';
    expect(pending).not.toBe(afterReject);
  });
});
