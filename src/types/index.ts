export type MemoryLayer = 'WM' | 'SWM' | 'VM';

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url?: string;
  html_url?: string;
}

export interface GitHubCommit {
  sha: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  message: string;
  url: string;
}

export interface GitHubReviewComment {
  id: number;
  user: GitHubUser;
  body: string;
  path?: string;
  line?: number;
  created_at: string;
  commit_id?: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  user: GitHubUser;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  head_sha: string;
  base_branch: string;
  html_url: string;
  labels: string[];
  reviews: GitHubReviewComment[];
  comments: GitHubReviewComment[];
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  user: GitHubUser;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  html_url: string;
  labels: string[];
  comments_count: number;
  comments: GitHubReviewComment[];
}

export interface DKGContextGraph {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface TriModalKnowledgeAsset {
  ual?: string;
  name: string;
  memoryLayer: MemoryLayer;
  contextGraphId: string;
  narrativeMarkdown: string;
  structuralTriples: string; // N-Quads or Turtle RDF
  metadata: {
    sourceUrl: string;
    commitSha?: string;
    author: string;
    generatedAt: string;
    tags: string[];
    isArchitectureDecision: boolean;
  };
}

export interface DKGMemoryTurnRequest {
  agentId: string;
  contextGraphId: string;
  turnContent: string;
  assertions?: {
    name: string;
    content: string; // RDF or JSON-LD
    format?: 'n-quads' | 'json-ld' | 'turtle';
  }[];
}

export interface DKGMemoryTurnResponse {
  turnId: string;
  assertionIds: string[];
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

export interface DKGPromoteRequest {
  assertionName: string;
  targetContextGraphId: string;
  promoterIdentity?: string;
}

export interface DKGPromoteResponse {
  promotedAssertionId: string;
  sharedContextGraphId: string;
  status: 'PROMOTED' | 'PENDING_CURATOR' | 'REJECTED';
}

export interface DKGSearchQuery {
  query: string;
  contextGraphId?: string;
  memoryLayers?: MemoryLayer[];
  limit?: number;
}

export interface DKGSearchResultItem {
  assertionId: string;
  memoryLayer: MemoryLayer;
  contextGraphId: string;
  content: string;
  score: number;
  provenance?: {
    sourceUrl?: string;
    commitSha?: string;
    generatedAtTime?: string;
  };
}

export interface EngineConfig {
  githubToken?: string;
  dkgApiUrl: string;
  dkgAuthToken?: string;
  defaultContextGraphId: string;
  autoPromoteLabels: string[];
  maxTokensPerAsset: number;
}
