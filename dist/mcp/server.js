import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GitHubClient } from '../client/github.js';
import { DKGClient } from '../client/dkg.js';
import { AssetSynthesizer } from '../synthesizer/provo.js';
import { CuratorGate } from '../curator/gate.js';
export class DkgMcpServer {
    server;
    githubClient;
    dkgClient;
    curatorGate;
    constructor() {
        this.server = new Server({
            name: 'github-dkg-engine',
            version: '0.1.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        this.githubClient = new GitHubClient();
        this.dkgClient = new DKGClient();
        this.curatorGate = new CuratorGate();
        this.setupHandlers();
    }
    setupHandlers() {
        const tools = [
            {
                name: 'dkg_search_memory',
                description: 'Searches OriginTrail DKG v10 Working and Shared Memory for architectural decisions, code reviews, and repository context.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Semantic or keyword search query (e.g. "auth middleware refactor")' },
                        contextGraphId: { type: 'string', description: 'Optional Context Graph namespace' },
                        limit: { type: 'number', description: 'Max items to return (default 5)' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'dkg_ingest_pr',
                description: 'Ingests a GitHub Pull Request and review discussion into DKG Working Memory as a tri-modal Knowledge Asset.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        owner: { type: 'string', description: 'Repository owner (e.g. "OriginTrail")' },
                        repo: { type: 'string', description: 'Repository name (e.g. "dkg")' },
                        pullNumber: { type: 'number', description: 'Pull request number' },
                        contextGraphId: { type: 'string', description: 'Context Graph ID to store under' },
                        promoteToShared: { type: 'boolean', description: 'Whether to promote immediately to Shared Working Memory if eligible' }
                    },
                    required: ['owner', 'repo', 'pullNumber']
                }
            },
            {
                name: 'dkg_promote_decision',
                description: 'Promotes an existing Working Memory assertion to Shared Working Memory through the Curator Gate.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        assertionName: { type: 'string', description: 'The assertion ID or name in Working Memory' },
                        targetContextGraphId: { type: 'string', description: 'Destination Shared Context Graph' },
                        promoterIdentity: { type: 'string', description: 'Curator identity DID or handle' }
                    },
                    required: ['assertionName', 'targetContextGraphId']
                }
            },
            {
                name: 'dkg_get_provenance',
                description: 'Retrieves W3C PROV-O provenance assertions for an ingested GitHub artifact from DKG.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        entityUri: { type: 'string', description: 'The entity URN (e.g. "urn:dkg:github:owner:repo:pr:123")' }
                    },
                    required: ['entityUri']
                }
            }
        ];
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                if (name === 'dkg_search_memory') {
                    const query = String(args?.query || '');
                    const contextGraphId = args?.contextGraphId ? String(args.contextGraphId) : undefined;
                    const limit = args?.limit ? Number(args.limit) : 5;
                    const results = await this.dkgClient.searchMemory({
                        query,
                        contextGraphId,
                        limit
                    });
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(results, null, 2)
                            }
                        ]
                    };
                }
                if (name === 'dkg_ingest_pr') {
                    const owner = String(args?.owner || '');
                    const repo = String(args?.repo || '');
                    const pullNumber = Number(args?.pullNumber || 0);
                    const contextGraphId = String(args?.contextGraphId || `repo-${owner}-${repo}`);
                    const promote = Boolean(args?.promoteToShared);
                    const pr = await this.githubClient.getPullRequest(owner, repo, pullNumber);
                    const asset = AssetSynthesizer.synthesizePullRequestAsset(owner, repo, pr, contextGraphId, 'WM');
                    // Store in Working Memory turn
                    const turnRes = await this.dkgClient.recordMemoryTurn({
                        agentId: 'github-dkg-agent',
                        contextGraphId,
                        turnContent: `Ingested GitHub PR #${pullNumber}: ${pr.title}`,
                        assertions: [
                            {
                                name: asset.name,
                                content: asset.structuralTriples,
                                format: 'turtle'
                            }
                        ]
                    });
                    let promotionResult = null;
                    if (promote) {
                        const eligibility = this.curatorGate.evaluateEligibility(asset, 'agent:github-dkg');
                        if (eligibility.eligible) {
                            promotionResult = await this.dkgClient.promoteToSharedMemory({
                                assertionName: asset.name,
                                targetContextGraphId: contextGraphId,
                                promoterIdentity: 'agent:github-dkg'
                            });
                            this.curatorGate.recordPromotion(asset, eligibility.assetDigest);
                        }
                        else {
                            promotionResult = { status: 'DENIED_BY_CURATOR', reason: eligibility.reason };
                        }
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    status: 'SUCCESS',
                                    assetName: asset.name,
                                    turnId: turnRes.turnId,
                                    memoryLayer: promote && promotionResult?.status === 'PROMOTED' ? 'SWM' : 'WM',
                                    isArchitectureDecision: asset.metadata.isArchitectureDecision,
                                    promotionResult
                                }, null, 2)
                            }
                        ]
                    };
                }
                if (name === 'dkg_promote_decision') {
                    const assertionName = String(args?.assertionName || '');
                    const targetContextGraphId = String(args?.targetContextGraphId || '');
                    const promoterIdentity = args?.promoterIdentity ? String(args.promoterIdentity) : 'agent:manual';
                    const res = await this.dkgClient.promoteToSharedMemory({
                        assertionName,
                        targetContextGraphId,
                        promoterIdentity
                    });
                    return {
                        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
                    };
                }
                if (name === 'dkg_get_provenance') {
                    const entityUri = String(args?.entityUri || '');
                    const sparql = `
SELECT ?p ?o WHERE {
  <${entityUri}> ?p ?o .
} LIMIT 50
`;
                    const queryRes = await this.dkgClient.query(sparql);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(queryRes, null, 2) }]
                    };
                }
                throw new Error(`Unknown tool: ${name}`);
            }
            catch (err) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Error executing tool ${name}: ${err.message}`
                        }
                    ]
                };
            }
        });
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('DKG MCP Server running on stdio');
    }
}
//# sourceMappingURL=server.js.map