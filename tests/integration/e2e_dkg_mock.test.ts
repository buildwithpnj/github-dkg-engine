import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { DKGClient } from '../../src/client/dkg.js';
import { AssetSynthesizer } from '../../src/synthesizer/provo.js';
import { SecretRedactor } from '../../src/synthesizer/redactor.js';
import { CuratorGate } from '../../src/curator/gate.js';
import { GitHubPullRequest } from '../../src/types/index.js';

describe('E2E DKG v10 Mock Server Integration', () => {
  let server: http.Server;
  let serverUrl: string;
  let client: DKGClient;

  // In-memory mock database for DKG node
  const db = {
    graphs: new Map<string, any>(),
    turns: new Map<string, any>(),
    assertions: new Map<string, any>()
  };

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const method = req.method;

      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      const data = body ? JSON.parse(body) : {};

      res.setHeader('Content-Type', 'application/json');

      if (url.pathname === '/api/agents' && method === 'GET') {
        res.writeHead(200);
        return res.end(JSON.stringify({ status: 'ONLINE', version: '10.0.0-mock' }));
      }

      if (url.pathname === '/api/context-graph/create' && method === 'POST') {
        db.graphs.set(data.id, data);
        res.writeHead(200);
        return res.end(JSON.stringify({ id: data.id, name: data.name, description: data.description }));
      }

      if (url.pathname === '/api/memory/turn' && method === 'POST') {
        const turnId = `turn-${Date.now()}`;
        db.turns.set(turnId, data);
        const assertionIds: string[] = [];
        for (const a of data.assertions || []) {
          db.assertions.set(a.name, { ...a, id: a.name });
          assertionIds.push(a.name);
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ turnId, assertionIds, status: 'SUCCESS' }));
      }

      if (url.pathname.startsWith('/api/assertion/') && url.pathname.endsWith('/promote') && method === 'POST') {
        const match = url.pathname.match(/\/api\/assertion\/([^/]+)\/promote/);
        const assertionName = match ? decodeURIComponent(match[1]) : '';
        const assertion = db.assertions.get(assertionName);
        if (!assertion) {
          res.writeHead(404);
          return res.end(JSON.stringify({ error: 'Assertion not found' }));
        }
        assertion.memoryLayer = 'SWM';
        assertion.targetContextGraphId = data.targetContextGraphId;
        res.writeHead(200);
        return res.end(JSON.stringify({
          promotedAssertionId: assertionName,
          sharedContextGraphId: data.targetContextGraphId,
          status: 'PROMOTED'
        }));
      }

      if (url.pathname === '/api/memory/search' && method === 'POST') {
        const queryText = (data.query || '').toLowerCase();
        const allowedLayers = new Set(data.memoryLayers || ['WM', 'SWM']);
        const matched: any[] = [];

        for (const [_, a] of db.assertions.entries()) {
          if (!allowedLayers.has(a.memoryLayer)) continue;
          if (a.contextGraphId && data.contextGraphId && a.contextGraphId !== data.contextGraphId) continue;

          const narrative = (a.narrativeMarkdown || '').toLowerCase();
          const triples = (a.structuralTriples || '').toLowerCase();
          if (narrative.includes(queryText) || triples.includes(queryText)) {
            matched.push({
              assertionId: a.name,
              memoryLayer: a.memoryLayer,
              contextGraphId: a.contextGraphId,
              content: a.narrativeMarkdown,
              score: 0.98,
              provenance: a.metadata
            });
          }
        }

        res.writeHead(200);
        return res.end(JSON.stringify({ results: matched.slice(0, data.limit || 10) }));
      }

      res.writeHead(404);
      return res.end(JSON.stringify({ error: `Not Found: ${url.pathname}` }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${addr.port}`;
    client = new DKGClient({ apiUrl: serverUrl });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('executes complete ingestion, secret scrubbing, provenance synthesis, and WM turn flow', async () => {
    // 1. Verify health ping
    const ping = await client.ping();
    expect(ping.status).toBe('ONLINE');
    expect(ping.version).toBe('10.0.0-mock');

    // 2. Create Context Graph
    const graph = await client.createContextGraph(
      'cg-repo-origintrail-dkg',
      'OriginTrail DKG Core Knowledge Graph',
      'Context Graph for PRs, Architecture Decisions, and Reviews'
    );
    expect(graph.id).toBe('cg-repo-origintrail-dkg');

    // 3. Raw Pull Request containing a leaked test token and architecture decision
    const rawPr: GitHubPullRequest = {
      number: 842,
      title: 'feat(consensus): implement verifiable threshold clocking',
      body: 'Introduced threshold clocking. Config used: token=ghp_ABC1234567890abcdefghijklmnopqrstuvw for dev relay.',
      user: { login: 'dev-contributor', id: 7712 },
      state: 'closed',
      merged: true,
      merged_at: '2026-05-12T14:22:00Z',
      created_at: '2026-05-12T12:00:00Z',
      updated_at: '2026-05-12T14:22:00Z',
      head_sha: 'a89c425039fbe61d655f5223c683b5dcae984110',
      base_branch: 'main',
      html_url: 'https://github.com/OriginTrail/dkg/pull/842',
      labels: ['architecture-decision', 'consensus', 'core'],
      reviews: [
        {
          id: 991,
          user: { login: 'senior-architect', id: 101 },
          body: 'Approved! Clock skew verification matches RFC 7748 specification.',
          created_at: '2026-05-12T14:00:00Z'
        }
      ],
      comments: []
    };

    // 4. Synthesize Tri-modal Knowledge Asset (with secret scrubbing)
    const asset = AssetSynthesizer.synthesizePullRequestAsset(
      'OriginTrail',
      'dkg',
      rawPr,
      graph.id,
      'WM'
    );

    // Assert secret scrubbing occurred
    expect(asset.narrativeMarkdown).not.toContain('ghp_ABC1234567890abcdefghijklmnopqrstuvw');
    expect(asset.narrativeMarkdown).toContain('[REDACTED_GITHUB_PAT]');
    expect(asset.metadata.isArchitectureDecision).toBe(true);

    // 5. Record Working Memory turn
    const turnRes = await client.recordMemoryTurn({
      agentId: 'agent-github-dkg-engine',
      contextGraphId: graph.id,
      turnContent: 'Ingested architecture decision from GitHub PR #842',
      assertions: [asset]
    });
    expect(turnRes.status).toBe('SUCCESS');
    expect(turnRes.assertionIds).toContain(asset.name);

    // 6. Search Working Memory: Agent A retrieves it from WM
    const searchWm = await client.searchMemory({
      query: 'threshold clocking',
      contextGraphId: graph.id,
      memoryLayers: ['WM']
    });
    expect(searchWm.length).toBe(1);
    expect(searchWm[0].memoryLayer).toBe('WM');
    expect(searchWm[0].content).toContain('Architecture Decision Record');

    // 7. Verify not visible in SWM before promotion
    const searchSwmBefore = await client.searchMemory({
      query: 'threshold clocking',
      contextGraphId: graph.id,
      memoryLayers: ['SWM']
    });
    expect(searchSwmBefore.length).toBe(0);

    // 8. Curator Gate evaluates eligibility for Shared Working Memory promotion
    const curatorGate = new CuratorGate({
      requireArchitectureTag: true,
      allowedPromoters: ['did:curator:senior-architect']
    });

    const eligibility = curatorGate.evaluateEligibility(asset, 'did:curator:senior-architect');
    expect(eligibility.eligible).toBe(true);

    // Record promotion invariant
    curatorGate.recordPromotion(asset, eligibility.assetDigest);

    // 9. Execute promotion on DKG node
    const promoteRes = await client.promoteToSharedMemory({
      assertionName: asset.name,
      targetContextGraphId: 'cg-shared-architecture',
      promoterIdentity: 'did:curator:senior-architect'
    });
    expect(promoteRes.status).toBe('PROMOTED');

    // 10. Multi-Agent Shared Working Memory Discovery: Agent B searches SWM
    const searchSwmAfter = await client.searchMemory({
      query: 'RFC 7748',
      memoryLayers: ['SWM']
    });
    expect(searchSwmAfter.length).toBe(1);
    expect(searchSwmAfter[0].memoryLayer).toBe('SWM');
    expect(searchSwmAfter[0].provenance.author).toBe('dev-contributor');
    expect(searchSwmAfter[0].provenance.commitSha).toBe('a89c425039fbe61d655f5223c683b5dcae984110');
  });
});
