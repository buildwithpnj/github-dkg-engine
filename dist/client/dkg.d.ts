import { DKGContextGraph, DKGMemoryTurnRequest, DKGMemoryTurnResponse, DKGPromoteRequest, DKGPromoteResponse, DKGSearchQuery, DKGSearchResultItem } from '../types/index.js';
export interface DKGClientOptions {
    apiUrl?: string;
    authToken?: string;
    maxRetries?: number;
}
export declare class DkgApiError extends Error {
    status: number;
    endpoint?: string | undefined;
    constructor(status: number, message: string, endpoint?: string | undefined);
}
export declare class DKGClient {
    private apiUrl;
    private authToken?;
    private maxRetries;
    constructor(options?: DKGClientOptions);
    private request;
    /**
     * Health / ping check against the DKG node.
     */
    ping(): Promise<{
        status: string;
        version?: string;
    }>;
    /**
     * Creates or ensures a Context Graph exists on the node.
     * `POST /api/context-graph/create`
     */
    createContextGraph(id: string, name: string, description?: string): Promise<DKGContextGraph>;
    /**
     * Records a Working Memory turn containing synthesized knowledge assertions.
     * `POST /api/memory/turn`
     */
    recordMemoryTurn(turn: DKGMemoryTurnRequest): Promise<DKGMemoryTurnResponse>;
    /**
     * Promotes a Working Memory assertion to Shared Working Memory (SWM).
     * `POST /api/assertion/{name}/promote`
     */
    promoteToSharedMemory(promote: DKGPromoteRequest): Promise<DKGPromoteResponse>;
    /**
     * Searches across Working Memory and Shared Working Memory layers.
     * `POST /api/memory/search`
     */
    searchMemory(query: DKGSearchQuery): Promise<DKGSearchResultItem[]>;
    /**
     * Executes a SPARQL query over the local or shared graph.
     * `POST /api/query`
     */
    query(sparqlQuery: string, contextGraphId?: string): Promise<any>;
}
//# sourceMappingURL=dkg.d.ts.map