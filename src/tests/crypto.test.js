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

describe('crypto utils', () => {
  it('hashes content consistently', async () => {
    const { hashContent, hashToken, generateSecureToken, encrypt, decrypt } = await import(
      '../utils/crypto.js'
    );
    expect(hashContent(' hello ')).toBe(hashContent('hello'));
    const token = generateSecureToken();
    expect(hashToken(token)).toHaveLength(64);
    const enc = encrypt('secret-value');
    expect(decrypt(enc)).toBe('secret-value');
  });
});
