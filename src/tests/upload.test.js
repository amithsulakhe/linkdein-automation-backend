import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.APP_BASE_URL = 'http://localhost:5000';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-chars-min!!';
});

describe('document upload validation', () => {
  it('rejects mismatched extension and mime', async () => {
    const { validateUpload } = await import('../validators/documentValidation.js');
    expect(() =>
      validateUpload({
        originalname: 'notes.pdf',
        mimetype: 'text/plain',
        size: 100,
      })
    ).toThrow(/Unsupported/);
  });
});
