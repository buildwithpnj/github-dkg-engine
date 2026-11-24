import { describe, it, expect } from 'vitest';
import { SecretRedactor } from '../../src/synthesizer/redactor.js';

describe('SecretRedactor', () => {
  it('should redact GitHub Personal Access Tokens', () => {
    const raw = 'My token is ghp_111122223333444455556666777788889999 and works fine.';
    const { cleanText, redactedCount } = SecretRedactor.redact(raw);
    expect(redactedCount).toBe(1);
    expect(cleanText).not.toContain('ghp_111122223333444455556666777788889999');
    expect(cleanText).toContain('[REDACTED_GITHUB_PAT]');
  });

  it('should redact private keys and bearer tokens', () => {
    const raw = 'Auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----';
    const { cleanText, redactedCount } = SecretRedactor.redact(raw);
    expect(redactedCount).toBeGreaterThanOrEqual(2);
    expect(cleanText).toContain('[REDACTED_GENERIC_BEARER]');
    expect(cleanText).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('should redact emails (PII)', () => {
    const raw = 'Contact the author at alice.developer@example.com for questions.';
    const { cleanText, redactedCount } = SecretRedactor.redact(raw);
    expect(redactedCount).toBe(1);
    expect(cleanText).toContain('[REDACTED_EMAIL_PII]');
  });

  it('should truncate oversized text for Context Graph bounds', () => {
    const huge = 'A'.repeat(15000);
    const sanitized = SecretRedactor.sanitizeMarkdown(huge, 1000);
    expect(sanitized.length).toBeLessThan(1200);
    expect(sanitized).toContain('[... Truncated');
  });
});
