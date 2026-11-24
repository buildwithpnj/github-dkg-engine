# Architectural Design Brief: GitHub-to-DKG Working Memory Engine (`github-dkg-engine`)

**Contributor:** Prakash N. Jha (`buildwithpnj` / `callmepnj@gmail.com`)  
**Package:** `@buildwithpnj/github-dkg-engine`  
**Target Platform:** OriginTrail Decentralized Knowledge Graph (DKG) v10  
**Specification Version:** 1.0.0 (Round 1 Bounty Track)  
**License:** Apache-2.0  

---

## Executive Summary

The **GitHub-to-DKG Working Memory Engine (`github-dkg-engine`)** is an enterprise-grade knowledge integration bridge connecting GitHub software development lifecycles to OriginTrail DKG v10's dual-tier dynamic memory system: **Working Memory (WM)** and **Shared Working Memory (SWM)**.

Modern software organizations deploy autonomous coding agents (Claude Code, Cursor, Windsurf, OpenClaw) that produce hundreds of micro-decisions, architectural patterns, and debugging resolutions daily. However, these insights remain trapped in ephemeral chat sessions or disconnected GitHub pull requests, issues, and discussions. Consequently, AI agents repeatedly re-encounter resolved bugs, violate unwritten architectural invariants, and operate without cross-agent contextual consensus.

`github-dkg-engine` bridges this foundational gap. It transforms GitHub development activity into **tri-modal Knowledge Assets** conforming to the **W3C PROV-O (Provenance Ontology)** standard. Ingested knowledge is stored within DKG v10 Working Memory, indexed via Context Graphs, and made searchable across multi-agent sessions. Substantive architectural decisions undergo automated and human-in-the-loop governance via the **Curator Gate**, promoting verified insights to Shared Working Memory for fleet-wide agent retrieval.

---

## 1. System Architecture & Topology

The system operates as a hybrid architecture consisting of:
1. **Model Context Protocol (MCP) Server**: Provides native tool-calling capabilities (`dkg_search_memory`, `dkg_ingest_pr`, `dkg_promote_decision`, `dkg_get_provenance`) directly into agent runtimes.
2. **Enterprise CLI**: Standalone administrative interface for continuous CI/CD synchronization, manual promotions, and health diagnostics.
3. **DKG Client Middleware**: Resilient HTTP transport client strictly targeting official DKG v10 public interfaces (`/api/context-graph/create`, `/api/memory/turn`, `/api/assertion/{name}/promote`, `/api/memory/search`, `/api/query`).

```
 +-------------------------------------------------------------------------+
 |                         AI AGENT RUNTIMES                               |
 |   Claude Code   *   Cursor / Windsurf   *   Autonomous Swarm Agents     |
 +-----------------------------------+-------------------------------------+
                                     | MCP Protocol (stdio / JSON-RPC 2.0)
                                     v
 +-------------------------------------------------------------------------+
 |                @buildwithpnj/github-dkg-engine                          |
 |                                                                         |
 |  +-----------------------+  +-------------------+  +-----------------+  |
 |  |  MCP Tool Provider    |  |  Enterprise CLI   |  | Secret Redactor |  |
 |  +-----------+-----------+  +---------+---------+  +--------+--------+  |
 |              |                        |                     |           |
 |              +------------------------+---------------------+           |
 |                                       |                                 |
 |  +------------------------------------v------------------------------+  |
 |  |                      Asset Synthesizer (PROV-O)                   |  |
 |  |    - W3C PROV-O RDF Triples Generator                             |  |
 |  |    - Narrative Architectural Markdown Synthesizer                 |  |
 |  |    - JSON-LD Structured Metadata Context                          |  |
 |  +------------------------------------+------------------------------+  |
 |                                       |                                 |
 |  +------------------------------------v------------------------------+  |
 |  |               Curator Gate (Governance & Invariants)              |  |
 |  |    - SHA-256 Digest Integrity Verification                        |  |
 |  |    - Architecture Decision Tag Policy                             |  |
 |  |    - Single-Consume Promotion Invariant Tracking                  |  |
 |  |    - Identity Allowlist Enforcement                               |  |
 |  +------------------------------------+------------------------------+  |
 |                                       |                                 |
 |  +------------------------------------v------------------------------+  |
 |  |               DKG v10 Public Interface Client                     |  |
 |  |    - Exponential Backoff & Jitter Handling                        |  |
 |  |    - ETag-based Delta Ingestion                                   |  |
 |  +------------------------------------+------------------------------+  |
 +---------------------------------------|---------------------------------+
                                         |
                       DKG v10 Public REST API (port 9200)
                                         |
     +-----------------------------------v---------------------------------+
     |                  ORIGINTRAIL DKG v10 NODE                           |
     |                                                                     |
     |  +------------------------------+  +-----------------------------+  |
     |  |     WORKING MEMORY (WM)      |  | SHARED WORKING MEMORY (SWM)|  |
     |  | - Agent-scoped context       |  | - Cluster-wide shared state |  |
     |  | - Ephemeral turn storage     |  | - Verified ADR assertions   |  |
     |  | - Local SPARQL graph         |  | - Multi-agent consensus     |  |
     |  +------------------------------+  +-----------------------------+  |
     +---------------------------------------------------------------------+
```

---

## 2. Core Functional Components

### 2.1 GitHub Client with Delta Sync (`src/client/github.ts`)
- Authenticates securely via `GITHUB_TOKEN` or Personal Access Token (PAT).
- Enforces strict HTTP caching using `If-None-Match` (ETag) and `If-Modified-Since` headers to prevent GitHub rate-limit exhaustion.
- Extracts Pull Requests, Review Comments, Issue threads, and Commit metadata.
- Preserves full author identities (`did:github:user:<login>`), commit hashes, and temporal timestamps.

### 2.2 Deep Secret & PII Redactor (`src/synthesizer/redactor.ts`)
- Zero-leakage credential scrubber operating before any text reaches the knowledge synthesizer.
- Scrubbing coverage:
  - GitHub Personal Access Tokens (`ghp_*`, `gho_*`, `ghu_*`, `ghs_*`, `ghr_*`).
  - Fine-grained Personal Access Tokens (`github_pat_*`).
  - Bearer & OAuth JWT tokens (`Bearer eyJ...`).
  - RSA, EC, OpenSSH, and PGP private keys (`-----BEGIN ... PRIVATE KEY-----`).
  - AWS Access Keys (`AKIA[0-9A-Z]{16}`).
  - Generic High-Entropy API Keys (`api_key=...`, `secret=...`).
  - Developer email addresses (PII preservation).
- Enforces contextual truncation guards to keep narrative markdown within Context Graph buffer limits.

### 2.3 Tri-Modal Asset Synthesizer (`src/synthesizer/provo.ts`)
Synthesizes tri-modal knowledge assets composed of:
1. **Narrative Markdown**: Human-readable and LLM-optimized technical summaries containing PR descriptions, review feedback, resolution rationales, and architecture decisions.
2. **Structural PROV-O Triples**: W3C-standard RDF graph representations:
   ```turtle
   @prefix prov: <http://www.w3.org/ns/prov#> .
   @prefix dkg: <http://origintrail.io/ontology/dkg#> .
   @prefix schema: <http://schema.org/> .

   <urn:dkg:github:asset:OriginTrail:dkg:pr:842> a prov:Entity, schema:DigitalDocument ;
       prov:wasAttributedTo <did:github:user:dev-contributor> ;
       prov:wasDerivedFrom <https://github.com/OriginTrail/dkg/pull/842> ;
       dkg:commitSha "a89c425039fbe61d655f5223c683b5dcae984110" ;
       dkg:memoryLayer "WM" ;
       dkg:inContextGraph <urn:dkg:graph:cg-repo-origintrail-dkg> ;
       prov:generatedAtTime "2026-05-12T14:22:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
   ```
3. **Structured JSON-LD Metadata**: Typed metadata indexing commit SHAs, tags, ADR status, and source URLs.

### 2.4 Curator Authority Gate (`src/curator/gate.ts`)
To prevent "hallucination spam" or unverified code changes from polluting Shared Working Memory, the Curator Gate enforces strict promotion invariants:
- **Cryptographic Digest**: Calculates a deterministic SHA-256 digest over the asset's structural triples and narrative content.
- **Single-Consume Invariant**: Tracks digested assertions to ensure no asset can be promoted multiple times, preventing SWM race conditions.
- **Tag Validation**: Requires explicit architectural tagging (`architecture-decision`, `adr`, `consensus`, `core`) when strict ADR policy is activated.
- **Authority Allowlist**: Restricts promotion triggers to authorized maintainer identities or trusted agent roles.

### 2.5 Resilient DKG Node Client (`src/client/dkg.ts`)
- Communicates directly with DKG v10 HTTP endpoints on `localhost:9200`.
- Transparent exponential backoff with jitter on HTTP 500/502/503/504 errors.
- Immediate rejection on HTTP 4xx client errors (no looping on authorization or validation errors).
- Clean mapping between TypeScript data contracts and DKG Context Graph representations.

### 2.6 Model Context Protocol (MCP) Server (`src/mcp/server.ts`)
Exposes 4 production MCP tools to AI agent runtimes:
- `dkg_search_memory`: Cross-layer query over WM and SWM to discover existing architectural decisions and bug fixes.
- `dkg_ingest_pr`: On-demand ingestion of specific GitHub PRs into DKG Working Memory.
- `dkg_promote_decision`: Curator-authenticated promotion of a Working Memory assertion to Shared Working Memory.
- `dkg_get_provenance`: Retrieval of W3C PROV-O provenance triples and source commit verification for any DKG assertion.

---

## 3. Data Contracts & Standards Compliance

### 3.1 DKG Memory Hierarchy Mapping
| Memory Layer | Storage Mechanism | Intended Scope | Mutation Rule |
| :--- | :--- | :--- | :--- |
| **Working Memory (WM)** | Context Graph Turn Store (`/api/memory/turn`) | Local to current agent session or repo sync | Un-gated ingestion after secret redaction |
| **Shared Working Memory (SWM)** | Promoted Assertion Store (`/api/assertion/:name/promote`) | Fleet-wide; visible to all authorized agents | Requires Curator Gate authorization |
| **Verifiable Memory (VM)** | On-chain Merkle Root Minting | Permanent decentralized ledger | Out of scope for Round 1 (strictly preserved for future DKG v10 phases) |

### 3.2 W3C PROV-O Mapping
- **`prov:Entity`**: The synthesized knowledge asset representing a PR, Issue, or ADR.
- **`prov:Agent`**: The GitHub author (`did:github:user:<id>`) or curator (`did:curator:<id>`).
- **`prov:Activity`**: The code review or engineering turn that produced the decision.
- **`prov:wasAttributedTo`**: Maps asset to contributor GitHub DID.
- **`prov:wasDerivedFrom`**: Maps asset to canonical GitHub HTML URL.
- **`prov:wasGeneratedBy`**: Maps asset to `github-dkg-engine` ingestion activity.

---

## 4. Security, Isolation & Boundary Architecture

1. **Strict Interface Compliance**:
   - `github-dkg-engine` operates strictly as an external client connecting via public HTTP/MCP protocols.
   - Zero private package dependencies or node core internal monkey-patching, ensuring 100% compliance with DKG bounty qualification criteria.
2. **Network Egress Boundaries**:
   - Outbound network requests are strictly constrained to:
     - `https://api.github.com` (authenticated GitHub API)
     - `http://localhost:9200` (local DKG v10 node)
   - Zero telemetry, analytics, or third-party egress.
3. **Npm Package Security**:
   - Zero `preinstall`, `install`, or `postinstall` shell scripts in `package.json`.
   - Dependency footprint audited and locked: `@modelcontextprotocol/sdk`, `commander`, `chalk`, `zod`.
4. **Credential Isolation**:
   - Secrets (`GITHUB_TOKEN`, `DKG_AUTH_TOKEN`) are read exclusively from process environment variables and are never persisted in state graphs or log streams.

---

## 5. Verification & Testing Methodology

The package adheres to rigorous testing standards:
1. **Unit Testing**:
   - `redactor.test.ts`: Validates token scrubbing across all patterns.
   - `provo.test.ts`: Verifies RDF syntax, PROV-O predicates, and markdown rendering.
   - `curator.test.ts`: Verifies SHA-256 digest determinism, single-consume tracking, and allowlist validation.
   - `dkg.test.ts`: Validates HTTP client payloads, auth headers, and retry backoff logic.
2. **End-to-End Integration Testing (`e2e_dkg_mock.test.ts`)**:
   - Spins up an in-process mock HTTP DKG v10 server.
   - Validates the entire pipeline: Ingestion -> Secret Scrubbing -> PROV-O Triples -> WM Turn Submission -> Curator Gate Evaluation -> SWM Promotion -> Cross-Layer Search Retrieval.
3. **Registry Conformance Validation**:
   - Validated against official OriginTrail `dkg-integrations` CI scripts (`validate.mjs` and `security-checks.mjs`).

---

## 6. Roadmap & Future Expansion

- **Round 2 (Verifiable Memory)**: Implement on-chain assertion anchoring using Knowledge Tokens ($TRAC) on NeuroWeb / Base.
- **Bi-directional Sync**: Push DKG-promoted architectural consensus back to GitHub as sticky PR review comments or PR status checks.
- **Git Hook Integration**: Standalone git commit-msg and pre-push hooks to verify architecture decisions prior to remote push.
