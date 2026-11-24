import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DKGClient, DkgApiError } from '../../src/client/dkg.js';

describe('DKGClient Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should initialize with default URL and normalize trailing slashes', () => {
    const client = new DKGClient({ apiUrl: 'http://localhost:9200///' });
    expect((client as any).apiUrl).toBe('http://localhost:9200');
  });

  it('should return ONLINE status on successful ping', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ version: '10.1.0' })
    });

    const client = new DKGClient();
    const result = await client.ping();

    expect(result.status).toBe('ONLINE');
    expect(result.version).toBe('10.1.0');
  });

  it('should return OFFLINE status when ping fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const client = new DKGClient();
    const result = await client.ping();

    expect(result.status).toBe('OFFLINE');
  });

  it('should create context graph with correct payload and headers', async () => {
    let capturedUrl = '';
    let capturedOptions: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'cg-1', name: 'Engineering Graph' })
      };
    });

    const client = new DKGClient({ apiUrl: 'http://localhost:9200', authToken: 'test-token' });
    const res = await client.createContextGraph('cg-1', 'Engineering Graph', 'Main repository context');

    expect(capturedUrl).toBe('http://localhost:9200/api/context-graph/create');
    expect(capturedOptions?.method).toBe('POST');
    expect((capturedOptions?.headers as any)['Authorization']).toBe('Bearer test-token');
    expect(JSON.parse(capturedOptions?.body as string)).toEqual({
      id: 'cg-1',
      name: 'Engineering Graph',
      description: 'Main repository context'
    });
    expect(res.id).toBe('cg-1');
  });

  it('should record Working Memory turn with assertions', async () => {
    let capturedBody: any;
    global.fetch = vi.fn().mockImplementation(async (_url: string, options: RequestInit) => {
      capturedBody = JSON.parse(options.body as string);
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          turnId: 'turn-999',
          assertionIds: ['urn:assertion:1', 'urn:assertion:2'],
          status: 'SUCCESS'
        })
      };
    });

    const client = new DKGClient();
    const result = await client.recordMemoryTurn({
      agentId: 'agent-github-sync',
      contextGraphId: 'cg-1',
      turnContent: 'Ingested PR #101',
      assertions: [
        {
          name: 'github-pr-101',
          memoryLayer: 'WM',
          contextGraphId: 'cg-1',
          narrativeMarkdown: '# PR 101',
          structuralTriples: '<urn:pr:101> <rdf:type> <prov:Entity> .',
          metadata: {
            sourceUrl: 'https://github.com/OriginTrail/dkg/pull/101',
            author: 'alice',
            generatedAt: '2026-05-10T00:00:00Z',
            tags: ['test']
          }
        }
      ]
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.turnId).toBe('turn-999');
    expect(capturedBody.agentId).toBe('agent-github-sync');
    expect(capturedBody.assertions.length).toBe(1);
  });

  it('should promote assertion to Shared Working Memory', async () => {
    let capturedUrl = '';
    let capturedBody: any;

    global.fetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body as string);
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          promotedAssertionId: 'urn:assertion:adr-001',
          status: 'PROMOTED'
        })
      };
    });

    const client = new DKGClient();
    const result = await client.promoteToSharedMemory({
      assertionName: 'github-adr-001',
      targetContextGraphId: 'cg-shared-01',
      promoterIdentity: 'did:curator:lead'
    });

    expect(capturedUrl).toBe('http://localhost:9200/api/assertion/github-adr-001/promote');
    expect(capturedBody.targetContextGraphId).toBe('cg-shared-01');
    expect(capturedBody.promoterIdentity).toBe('did:curator:lead');
    expect(result.status).toBe('PROMOTED');
  });

  it('should search memory across layers and normalize results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        results: [
          {
            assertionId: 'urn:a1',
            memoryLayer: 'SWM',
            contextGraphId: 'cg-1',
            content: 'Consensus timeout is 5000ms',
            score: 0.95,
            provenance: { sourceUrl: 'https://github.com/OriginTrail/dkg/pull/42' }
          }
        ]
      })
    });

    const client = new DKGClient();
    const results = await client.searchMemory({
      query: 'consensus timeout',
      contextGraphId: 'cg-1',
      memoryLayers: ['WM', 'SWM'],
      limit: 5
    });

    expect(results.length).toBe(1);
    expect(results[0].assertionId).toBe('urn:a1');
    expect(results[0].memoryLayer).toBe('SWM');
    expect(results[0].content).toContain('timeout is 5000ms');
  });

  it('should execute SPARQL query', async () => {
    let capturedBody: any;
    global.fetch = vi.fn().mockImplementation(async (_url: string, options: RequestInit) => {
      capturedBody = JSON.parse(options.body as string);
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ results: { bindings: [] } })
      };
    });

    const client = new DKGClient();
    const res = await client.query('SELECT ?s WHERE { ?s ?p ?o } LIMIT 10', 'cg-1');

    expect(capturedBody.query).toContain('SELECT ?s');
    expect(capturedBody.contextGraphId).toBe('cg-1');
    expect(res).toBeDefined();
  });

  it('should fail immediately on 4xx error without retrying', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 400,
        text: async () => 'Bad Request: invalid payload'
      };
    });

    const client = new DKGClient({ maxRetries: 3 });
    await expect(client.createContextGraph('bad-id', 'Bad Graph')).rejects.toThrow(DkgApiError);
    expect(callCount).toBe(1);
  });

  it('should retry on 500 errors and succeed if transient', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service Temporarily Unavailable'
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'recovered-cg' })
      };
    });

    const client = new DKGClient({ maxRetries: 3 });
    const res = await client.createContextGraph('recovered-cg', 'Recovered Graph');

    expect(callCount).toBe(2);
    expect(res.id).toBe('recovered-cg');
  });
});
