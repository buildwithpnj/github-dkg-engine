import {
  DKGContextGraph,
  DKGMemoryTurnRequest,
  DKGMemoryTurnResponse,
  DKGPromoteRequest,
  DKGPromoteResponse,
  DKGSearchQuery,
  DKGSearchResultItem
} from '../types/index.js';

export interface DKGClientOptions {
  apiUrl?: string;
  authToken?: string;
  maxRetries?: number;
}

export class DkgApiError extends Error {
  constructor(public status: number, message: string, public endpoint?: string) {
    super(message);
    this.name = 'DkgApiError';
  }
}

export class DKGClient {
  private apiUrl: string;
  private authToken?: string;
  private maxRetries: number;

  constructor(options: DKGClientOptions = {}) {
    this.apiUrl = (options.apiUrl || process.env.DKG_API_URL || 'http://localhost:9200').replace(/\/+$/, '');
    this.authToken = options.authToken || process.env.DKG_AUTH_TOKEN;
    this.maxRetries = options.maxRetries ?? 3;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'github-dkg-engine/0.1.0'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: { ...headers, ...(options.headers as any) }
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return await response.json() as T;
          }
          const text = await response.text();
          return { message: text } as T;
        }

        const errText = await response.text();
        if (response.status >= 500 && attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
          continue;
        }

        throw new DkgApiError(response.status, `DKG API error [${response.status}]: ${errText}`, endpoint);
      } catch (err: any) {
        lastError = err;
        if (err instanceof DkgApiError && err.status < 500) {
          throw err;
        }
        if (attempt === this.maxRetries) {
          break;
        }
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
      }
    }

    throw lastError || new Error(`Failed request to DKG endpoint ${endpoint}`);
  }

  /**
   * Health / ping check against the DKG node.
   */
  public async ping(): Promise<{ status: string; version?: string }> {
    try {
      const res = await this.request<any>('/api/agents');
      return { status: 'ONLINE', version: res?.version || '10.0.0' };
    } catch (e: any) {
      return { status: 'OFFLINE' };
    }
  }

  /**
   * Creates or ensures a Context Graph exists on the node.
   * `POST /api/context-graph/create`
   */
  public async createContextGraph(id: string, name: string, description?: string): Promise<DKGContextGraph> {
    const payload = {
      id,
      name,
      description: description || `Repository Knowledge Context Graph for ${name}`
    };
    const res = await this.request<any>('/api/context-graph/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return {
      id: res.id || id,
      name: res.name || name,
      description
    };
  }

  /**
   * Records a Working Memory turn containing synthesized knowledge assertions.
   * `POST /api/memory/turn`
   */
  public async recordMemoryTurn(turn: DKGMemoryTurnRequest): Promise<DKGMemoryTurnResponse> {
    const payload = {
      agentId: turn.agentId,
      contextGraphId: turn.contextGraphId,
      turnContent: turn.turnContent,
      assertions: turn.assertions || []
    };
    const res = await this.request<any>('/api/memory/turn', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return {
      turnId: res.turnId || `turn-${Date.now()}`,
      assertionIds: res.assertionIds || [],
      status: 'SUCCESS'
    };
  }

  /**
   * Promotes a Working Memory assertion to Shared Working Memory (SWM).
   * `POST /api/assertion/{name}/promote`
   */
  public async promoteToSharedMemory(promote: DKGPromoteRequest): Promise<DKGPromoteResponse> {
    const endpoint = `/api/assertion/${encodeURIComponent(promote.assertionName)}/promote`;
    const payload = {
      targetContextGraphId: promote.targetContextGraphId,
      promoterIdentity: promote.promoterIdentity
    };
    const res = await this.request<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return {
      promotedAssertionId: res.promotedAssertionId || promote.assertionName,
      sharedContextGraphId: promote.targetContextGraphId,
      status: 'PROMOTED'
    };
  }

  /**
   * Searches across Working Memory and Shared Working Memory layers.
   * `POST /api/memory/search`
   */
  public async searchMemory(query: DKGSearchQuery): Promise<DKGSearchResultItem[]> {
    const payload = {
      query: query.query,
      contextGraphId: query.contextGraphId,
      memoryLayers: query.memoryLayers || ['WM', 'SWM'],
      limit: query.limit || 10
    };
    const res = await this.request<any>('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res.results || []).map((r: any) => ({
      assertionId: r.assertionId || r.id,
      memoryLayer: r.memoryLayer || 'WM',
      contextGraphId: r.contextGraphId || query.contextGraphId || '',
      content: r.content || r.snippet || '',
      score: r.score ?? 1.0,
      provenance: r.provenance
    }));
  }

  /**
   * Executes a SPARQL query over the local or shared graph.
   * `POST /api/query`
   */
  public async query(sparqlQuery: string, contextGraphId?: string): Promise<any> {
    const payload = {
      query: sparqlQuery,
      contextGraphId
    };
    return await this.request<any>('/api/query', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}
