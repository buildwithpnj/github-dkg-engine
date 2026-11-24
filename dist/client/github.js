export class GitHubApiError extends Error {
    status;
    rateLimitReset;
    constructor(status, message, rateLimitReset) {
        super(message);
        this.status = status;
        this.rateLimitReset = rateLimitReset;
        this.name = 'GitHubApiError';
    }
}
export class GitHubClient {
    token;
    baseUrl;
    etagCache = new Map();
    constructor(options = {}) {
        this.token = options.token || process.env.GITHUB_TOKEN;
        this.baseUrl = options.baseUrl || 'https://api.github.com';
    }
    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        const headers = {
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
        let response;
        try {
            response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
        }
        catch (netErr) {
            throw new GitHubApiError(0, `Network error communicating with GitHub API: ${netErr.message}`);
        }
        if (response.status === 304 && cached) {
            return { data: cached.data, notModified: true };
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
        return { data: data, notModified: false };
    }
    /**
     * Fetches a specific Pull Request including its line-level reviews and comments.
     */
    async getPullRequest(owner, repo, pullNumber) {
        const { data: pr } = await this.request(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
        // Fetch review comments
        let reviews = [];
        try {
            const { data: revData } = await this.request(`/repos/${owner}/${repo}/pulls/${pullNumber}/comments?per_page=100`);
            reviews = (revData || []).map(r => ({
                id: r.id,
                user: { login: r.user?.login || 'unknown', id: r.user?.id || 0 },
                body: r.body || '',
                path: r.path,
                line: r.line || r.original_line,
                created_at: r.created_at,
                commit_id: r.commit_id
            }));
        }
        catch {
            // Non-fatal if reviews fail
        }
        // Fetch issue-level conversation comments
        let comments = [];
        try {
            const { data: comData } = await this.request(`/repos/${owner}/${repo}/issues/${pullNumber}/comments?per_page=100`);
            comments = (comData || []).map(c => ({
                id: c.id,
                user: { login: c.user?.login || 'unknown', id: c.user?.id || 0 },
                body: c.body || '',
                created_at: c.created_at
            }));
        }
        catch {
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
            labels: (pr.labels || []).map((l) => l.name),
            reviews,
            comments
        };
    }
    /**
     * Fetches an Issue and its comments.
     */
    async getIssue(owner, repo, issueNumber) {
        const { data: issue } = await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}`);
        let comments = [];
        try {
            const { data: comData } = await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
            comments = (comData || []).map(c => ({
                id: c.id,
                user: { login: c.user?.login || 'unknown', id: c.user?.id || 0 },
                body: c.body || '',
                created_at: c.created_at
            }));
        }
        catch {
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
            labels: (issue.labels || []).map((l) => l.name),
            comments_count: issue.comments || 0,
            comments
        };
    }
    /**
     * Lists Pull Requests updated since a specific timestamp (incremental sync).
     */
    async listPullRequests(owner, repo, state = 'all', perPage = 20) {
        const { data: prList } = await this.request(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated&direction=desc`);
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
            labels: (pr.labels || []).map((l) => l.name),
            reviews: [],
            comments: []
        }));
    }
}
//# sourceMappingURL=github.js.map