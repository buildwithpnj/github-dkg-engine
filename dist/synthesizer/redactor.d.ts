/**
 * Secret & PII Scrubbing Engine
 * Ensures zero credential exfiltration or accidental secret leakage into DKG Knowledge Assets.
 */
export declare class SecretRedactor {
    /**
     * Redacts sensitive keys, tokens, and credentials from string input.
     * Preserves structural formatting while replacing secret spans.
     */
    static redact(text: string): {
        cleanText: string;
        redactedCount: number;
    };
    /**
     * Sanitizes markdown text to prevent prompt injection and header spoofing.
     */
    static sanitizeMarkdown(content: string, maxLen?: number): string;
}
//# sourceMappingURL=redactor.d.ts.map