import { GitHubPullRequest, GitHubIssue } from '../types/index.js';
export interface GitHubClientOptions {
    token?: string;
    baseUrl?: string;
}
export declare class GitHubApiError extends Error {
    status: number;
    rateLimitReset?: number | undefined;
    constructor(status: number, message: string, rateLimitReset?: number | undefined);
}
export declare class GitHubClient {
    private token?;
    private baseUrl;
    private etagCache;
    constructor(options?: GitHubClientOptions);
    private request;
    /**
     * Fetches a specific Pull Request including its line-level reviews and comments.
     */
    getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest>;
    /**
     * Fetches an Issue and its comments.
     */
    getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue>;
    /**
     * Lists Pull Requests updated since a specific timestamp (incremental sync).
     */
    listPullRequests(owner: string, repo: string, state?: 'open' | 'closed' | 'all', perPage?: number): Promise<GitHubPullRequest[]>;
}
//# sourceMappingURL=github.d.ts.map