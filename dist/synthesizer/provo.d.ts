import { GitHubPullRequest, GitHubIssue, TriModalKnowledgeAsset, MemoryLayer } from '../types/index.js';
export declare class AssetSynthesizer {
    /**
     * Synthesizes a tri-modal Knowledge Asset from a GitHub Pull Request and review comments.
     */
    static synthesizePullRequestAsset(repoOwner: string, repoName: string, pr: GitHubPullRequest, contextGraphId: string, memoryLayer?: MemoryLayer): TriModalKnowledgeAsset;
    /**
     * Synthesizes a tri-modal Knowledge Asset from a GitHub Issue and technical discussions.
     */
    static synthesizeIssueAsset(repoOwner: string, repoName: string, issue: GitHubIssue, contextGraphId: string, memoryLayer?: MemoryLayer): TriModalKnowledgeAsset;
}
//# sourceMappingURL=provo.d.ts.map