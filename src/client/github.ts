import { GitHubPullRequest, GitHubIssue, GitHubReviewComment } from '../types/index.js';

export interface GitHubClientOptions {
  token?: string;
  baseUrl?: string;
}

export class GitHubApiError extends Error {
  constructor(public status: number, message: string, public rateLimitReset?: number) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class GitHubClient {
  private token?: string;
  private baseUrl: string;
  private etagCache: Map<string, { etag: string; data: any }> = new Map();

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN;
    this.baseUrl = options.baseUrl || 'https://api.github.com';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; notModified: boolean }> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-dkg-engine/0.1.0'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Check ETag cache for GET requests
    const cacheKey = `${options.method || 'GET'}:${url}`;
    const cached = this.etagCache.get(cacheKey);
    if (cached && (!options.method || options.method === 'GET')) {
      headers['If-None-Match'] = cached.etag;
    }

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers as any) } });
    } catch (netErr: any) {
      throw new GitHubApiError(0, `Network error communicating with GitHub API: ${netErr.message}`);
    }

    if (response.status === 304 && cached) {
      return { data: cached.data as T, notModified: true };
    }

    // Rate-limit backoff handling
    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get('x-ratelimit-reset');
      const resetTime = resetHeader ? parseInt(resetHeader, 10) : undefined;
      const errorText = await response.text();
      throw new GitHubApiError(response.status, `GitHub rate limit exceeded: ${errorText}`, resetTime);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new GitHubApiError(response.status, `GitHub API error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const etag = response.headers.get('etag');
    if (etag && (!options.method || options.method === 'GET')) {
      this.etagCache.set(cacheKey, { etag, data });
    }

    return { data: data as T, notModified: false };
  }

  /**
   * Fetches a specific Pull Request including its line-level reviews and comments.
   */
  public async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    const { data: pr } = await this.request<any>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    
    // Fetch review comments
    let reviews: GitHubReviewComment[] = [];
    try {
      const { data: revData } = await this.request<any[]>(`/repos/${owner}/${repo}/pulls/${pullNumber}/comments?per_page=100`);
      reviews = (revData || []).map(r => ({
        id: r.id,
        user: { login: r.user?.login || 'unknown', id: r.user?.id || 0 },
        body: r.body || '',
        path: r.path,
        line: r.line || r.original_line,
        created_at: r.created_at,
        commit_id: r.commit_id
      }));
    } catch {
      // Non-fatal if reviews fail
    }

    // Fetch issue-level conversation comments
    let comments: GitHubReviewComment[] = [];
    try {
      const { data: comData } = await this.request<any[]>(`/repos/${owner}/${repo}/issues/${pullNumber}/comments?per_page=100`);
      comments = (comData || []).map(c => ({
        id: c.id,
        user: { login: c.user?.login || 'unknown', id: c.user?.id || 0 },
        body: c.body || '',
        created_at: c.created_at
      }));
    } catch {
      // Non-fatal
    }

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      user: { login: pr.user?.login || 'unknown', id: pr.user?.id || 0 },
      state: pr.state,
      merged: !!pr.merged_at,
      merged_at: pr.merged_at,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      head_sha: pr.head?.sha || 'unknown',
      base_branch: pr.base?.ref || 'main',
      html_url: pr.html_url,
      labels: (pr.labels || []).map((l: any) => l.name),
      reviews,
      comments
    };
  }

  /**
   * Fetches an Issue and its comments.
   */
  public async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const { data: issue } = await this.request<any>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    
    let comments: GitHubReviewComment[] = [];
    try {
      const { data: comData } = await this.request<any[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
      comments = (comData || []).map(c => ({
        id: c.id,
        user: { login: c.user?.login || 'unknown', id: c.user?.id || 0 },
        body: c.body || '',
        created_at: c.created_at
      }));
    } catch {
      // Non-fatal
    }

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      user: { login: issue.user?.login || 'unknown', id: issue.user?.id || 0 },
      state: issue.state,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      html_url: issue.html_url,
      labels: (issue.labels || []).map((l: any) => l.name),
      comments_count: issue.comments || 0,
      comments
    };
  }

  /**
   * Lists Pull Requests updated since a specific timestamp (incremental sync).
   */
  public async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all', perPage = 20): Promise<GitHubPullRequest[]> {
    const { data: prList } = await this.request<any[]>(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated&direction=desc`);
    return (prList || []).map(pr => ({
      number: pr.number,
      title: pr.title,
      body: pr.body,
      user: { login: pr.user?.login || 'unknown', id: pr.user?.id || 0 },
      state: pr.state,
      merged: !!pr.merged_at,
      merged_at: pr.merged_at,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      head_sha: pr.head?.sha || 'unknown',
      base_branch: pr.base?.ref || 'main',
      html_url: pr.html_url,
      labels: (pr.labels || []).map((l: any) => l.name),
      reviews: [],
      comments: []
    }));
  }
}
