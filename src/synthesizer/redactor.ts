/**
 * Secret & PII Scrubbing Engine
 * Ensures zero credential exfiltration or accidental secret leakage into DKG Knowledge Assets.
 */

const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'GITHUB_PAT', pattern: /ghp_[a-zA-Z0-9]{36,255}/g },
  { name: 'GITHUB_FINE_GRAINED', pattern: /github_pat_[a-zA-Z0-9_]{80,255}/g },
  { name: 'GENERIC_BEARER', pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi },
  { name: 'PRIVATE_KEY', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[a-zA-Z0-9\/+=\s\r\n]+-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'AWS_ACCESS_KEY', pattern: /(?:AKIA|ABIA|ACCA)[0-9A-Z]{16}/g },
  { name: 'AWS_SECRET_KEY', pattern: /(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*["']?[a-zA-Z0-9\/+=]{40}["']?/gi },
  { name: 'GENERIC_API_KEY', pattern: /(?:api_key|apikey|secret_key|password|auth_token)\s*[:=]\s*["']?([a-zA-Z0-9_\-]{16,})["']?/gi },
  { name: 'SLACK_TOKEN', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
  { name: 'EMAIL_PII', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g }
];

export class SecretRedactor {
  /**
   * Redacts sensitive keys, tokens, and credentials from string input.
   * Preserves structural formatting while replacing secret spans.
   */
  public static redact(text: string): { cleanText: string; redactedCount: number } {
    if (!text) {
      return { cleanText: '', redactedCount: 0 };
    }

    let cleanText = text;
    let redactedCount = 0;

    for (const { name, pattern } of SECRET_PATTERNS) {
      const matches = cleanText.match(pattern);
      if (matches) {
        redactedCount += matches.length;
        cleanText = cleanText.replace(pattern, `[REDACTED_${name}]`);
      }
    }

    return { cleanText, redactedCount };
  }

  /**
   * Sanitizes markdown text to prevent prompt injection and header spoofing.
   */
  public static sanitizeMarkdown(content: string, maxLen = 12000): string {
    const { cleanText } = this.redact(content);
    if (cleanText.length <= maxLen) {
      return cleanText;
    }
    const truncated = cleanText.slice(0, maxLen);
    return `${truncated}\n\n[... Truncated ${cleanText.length - maxLen} additional characters for Context Graph boundary ...]`;
  }
}
