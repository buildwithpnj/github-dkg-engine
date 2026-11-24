import { describe, it, expect } from 'vitest';
import { CuratorGate } from '../../src/curator/gate.js';
import { TriModalKnowledgeAsset } from '../../src/types/index.js';

describe('CuratorGate', () => {
  const sampleAsset: TriModalKnowledgeAsset = {
    name: 'test-asset-01',
    memoryLayer: 'WM',
    contextGraphId: 'test-graph',
    narrativeMarkdown: 'This is a substantive engineering decision regarding distributed hash tables and consensus.',
    structuralTriples: '<urn:test:01> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/DigitalDocument> .',
    metadata: {
      sourceUrl: 'https://github.com/OriginTrail/dkg/pull/1',
      author: 'alice',
      generatedAt: '2026-05-01T00:00:00Z',
      tags: ['architecture-decision'],
      isArchitectureDecision: true
    }
  };

  it('should compute deterministic SHA-256 digest', () => {
    const digest1 = CuratorGate.computeDigest(sampleAsset);
    const digest2 = CuratorGate.computeDigest(sampleAsset);
    expect(digest1).toBe(digest2);
    expect(digest1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should allow eligible asset promotion', () => {
    const gate = new CuratorGate();
    const result = gate.evaluateEligibility(sampleAsset, 'curator:lead');
    expect(result.eligible).toBe(true);
    expect(result.reason).toContain('satisfies all Curator Gate invariants');
  });

  it('should reject duplicate promotion (single-consume invariant)', () => {
    const gate = new CuratorGate();
    const result1 = gate.evaluateEligibility(sampleAsset, 'curator:lead');
    expect(result1.eligible).toBe(true);

    gate.recordPromotion(sampleAsset, result1.assetDigest);

    const result2 = gate.evaluateEligibility(sampleAsset, 'curator:lead');
    expect(result2.eligible).toBe(false);
    expect(result2.reason).toContain('already been promoted');
  });

  it('should enforce architecture-decision tag when policy requires it', () => {
    const gate = new CuratorGate({ requireArchitectureTag: true });
    
    const nonAdrAsset: TriModalKnowledgeAsset = {
      ...sampleAsset,
      metadata: { ...sampleAsset.metadata, isArchitectureDecision: false }
    };

    const result = gate.evaluateEligibility(nonAdrAsset, 'curator:lead');
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('requires "architecture-decision" tag');
  });

  it('should enforce promoter allowlist when configured', () => {
    const gate = new CuratorGate({ allowedPromoters: ['did:curator:lead', 'did:curator:admin'] });

    const unauthorized = gate.evaluateEligibility(sampleAsset, 'did:curator:intern');
    expect(unauthorized.eligible).toBe(false);
    expect(unauthorized.reason).toContain('not in the authorized curator allowlist');

    const authorized = gate.evaluateEligibility(sampleAsset, 'did:curator:lead');
    expect(authorized.eligible).toBe(true);
  });
});
