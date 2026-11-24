import { describe, it, expect } from 'vitest';
import { AssetSynthesizer } from '../../src/synthesizer/provo.js';
import { GitHubPullRequest, GitHubIssue } from '../../src/types/index.js';

describe('AssetSynthesizer', () => {
  it('should synthesize tri-modal Knowledge Asset from a Pull Request', () => {
    const mockPr: GitHubPullRequest = {
      number: 101,
      title: 'feat: add resilient retry logic for DKG node client',
      body: 'Refactors HTTP client to use exponential backoff on 503 errors.',
      user: { login: 'alice', id: 1234 },
      state: 'open',
      merged: false,
      merged_at: null,
      created_at: '2026-05-10T10:00:00Z',
      updated_at: '2026-05-10T11:00:00Z',
      head_sha: 'e4d909c290d0fb1ca068ffaddf22cbd0addf411e',
      base_branch: 'main',
      html_url: 'https://github.com/OriginTrail/dkg/pull/101',
      labels: ['architecture-decision', 'core'],
      reviews: [
        {
          id: 1,
          user: { login: 'bob', id: 5678 },
          body: 'LGTM! Ensure backoff jitter is tested.',
          created_at: '2026-05-10T10:30:00Z'
        }
      ],
      comments: []
    };

    const asset = AssetSynthesizer.synthesizePullRequestAsset(
      'OriginTrail',
      'dkg',
      mockPr,
      'graph-engineering',
      'WM'
    );

    expect(asset.name).toBe('github-pr-OriginTrail-dkg-101');
    expect(asset.memoryLayer).toBe('WM');
    expect(asset.contextGraphId).toBe('graph-engineering');
    expect(asset.metadata.isArchitectureDecision).toBe(true);
    expect(asset.metadata.commitSha).toBe('e4d909c290d0fb1ca068ffaddf22cbd0addf411e');

    // Narrative Markdown checks
    expect(asset.narrativeMarkdown).toContain('# GitHub Pull Request #101');
    expect(asset.narrativeMarkdown).toContain('🌟 Architecture Decision Record (ADR)');
    expect(asset.narrativeMarkdown).toContain('bob');

    // Structural PROV-O Triples checks
    expect(asset.structuralTriples).toContain('<http://www.w3.org/ns/prov#wasAttributedTo> <did:github:user:alice>');
    expect(asset.structuralTriples).toContain('<http://www.w3.org/ns/prov#wasDerivedFrom> <https://github.com/OriginTrail/dkg/pull/101>');
    expect(asset.structuralTriples).toContain('e4d909c290d0fb1ca068ffaddf22cbd0addf411e');
    expect(asset.structuralTriples).toContain('graph-engineering');
  });

  it('should synthesize tri-modal Knowledge Asset from an Issue', () => {
    const mockIssue: GitHubIssue = {
      number: 45,
      title: 'Memory leak in libp2p relay under high gossip traffic',
      body: 'Gossipsub message buffer never trims expired peer records.',
      user: { login: 'charlie', id: 9999 },
      state: 'open',
      created_at: '2026-04-01T08:00:00Z',
      updated_at: '2026-04-01T09:00:00Z',
      html_url: 'https://github.com/OriginTrail/dkg/issues/45',
      labels: ['bug', 'p2p'],
      comments_count: 1,
      comments: [
        {
          id: 10,
          user: { login: 'dave', id: 8888 },
          body: 'Fixed by setting maxCacheSize = 1000.',
          created_at: '2026-04-01T08:45:00Z'
        }
      ]
    };

    const asset = AssetSynthesizer.synthesizeIssueAsset(
      'OriginTrail',
      'dkg',
      mockIssue,
      'graph-p2p'
    );

    expect(asset.name).toBe('github-issue-OriginTrail-dkg-45');
    expect(asset.narrativeMarkdown).toContain('Fixed by setting maxCacheSize');
    expect(asset.structuralTriples).toContain('<http://www.w3.org/ns/prov#wasAttributedTo> <did:github:user:charlie>');
  });
});
