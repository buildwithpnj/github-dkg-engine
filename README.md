# GitHub-to-DKG Working Memory Engine (`github-dkg-engine`)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8_Strict-blue.svg)](https://www.typescriptlang.org/)
[![OriginTrail DKG](https://img.shields.io/badge/OriginTrail_DKG-v10_Ready-orange.svg)](https://origintrail.io)
[![Tests](https://img.shields.io/badge/Tests-22%20passed-brightgreen.svg)]()

Enterprise GitHub-to-DKG Working Memory and Decision Engine for **OriginTrail DKG v10**. Bridges GitHub repository activity (pull requests, code reviews, discussions, issues) into DKG **Working Memory (WM)** and **Shared Working Memory (SWM)**, providing persistent architectural memory and W3C PROV-O provenance to multi-agent coding swarms (Claude Code, Cursor, OpenClaw).

---

## 🚀 Key Capabilities

- **Delta Ingestion with Zero Rate-Limit Waste**: Leverages GitHub HTTP ETags and conditional requests to synchronize only changed PRs, reviews, and issues.
- **Deep Secret & PII Scrubbing**: Redacts GitHub PATs, JWT bearer tokens, SSH/RSA private keys, AWS access keys, and developer emails prior to knowledge synthesis.
- **Tri-Modal Asset Synthesis**: Generates tri-modal knowledge assets conforming to **W3C PROV-O (Provenance Ontology)**:
  1. *Narrative Markdown*: LLM-optimized technical summaries capturing architecture decisions and review rationales.
  2. *Structural RDF Triples*: Graph entities with `prov:wasAttributedTo`, `prov:wasDerivedFrom`, commit hashes, and temporal timestamps.
  3. *Structured JSON-LD Context*: Machine-readable schemas indexed by Context Graph IDs.
- **Curator Authority Gate**: Evaluates candidate assertions using cryptographic SHA-256 digests, strict ADR tagging policies, promoter allowlists, and a single-consume invariant to prevent duplicate or unverified promotions to Shared Working Memory.
- **Model Context Protocol (MCP) Server**: Exposes 4 native MCP tools for direct integration into agentic workflows.
- **Enterprise CLI**: Clean command-line utility for manual synchronization, inspection, and local DKG node diagnostics.

---

## 🛠️ Architecture

```
                    +--------------------------------+
                    |    AI AGENTS (Claude / Cursor) |
                    +---------------+----------------+
                                    | MCP Protocol
                                    v
       +---------------------------------------------------------+
       |             @buildwithpnj/github-dkg-engine             |
       |  - Secret Redactor     - PROV-O Synthesizer             |
       |  - Curator Gate        - Resilient HTTP Client          |
       +----------------------------+----------------------------+
                                    | DKG v10 REST API (:9200)
                                    v
       +---------------------------------------------------------+
       |               ORIGINTRAIL DKG v10 NODE                  |
       |  +-------------------------+  +-----------------------+ |
       |  |   WORKING MEMORY (WM)   |  | SHARED WORKING MEMORY | |
       |  |  Agent-scoped context   |  | Fleet-wide consensus  | |
       |  +-------------------------+  +-----------------------+ |
       +---------------------------------------------------------+
```

---

## 📦 Installation & Setup

### Requirements
- Node.js >= 20.0.0
- Running OriginTrail DKG v10 Node (default endpoint `http://localhost:9200`)
- GitHub Personal Access Token (PAT) with `repo` read access

### Global CLI Installation
```bash
npm install -g @buildwithpnj/github-dkg-engine
```

### Environment Configuration
```bash
export GITHUB_TOKEN="ghp_yourPersonalAccessToken"
export DKG_API_URL="http://localhost:9200"
export DKG_AUTH_TOKEN="your_optional_dkg_node_token"
```

---

## 💻 CLI Commands

### 1. Check Node Connectivity
```bash
github-dkg status
```
Outputs node connection status, DKG version, and authentication state.

### 2. Ingest Repository PRs into Working Memory
```bash
# Ingest single PR
github-dkg ingest --owner OriginTrail --repo dkg --pr 842 --graph cg-engineering

# Batch ingest latest merged PRs
github-dkg ingest --owner OriginTrail --repo dkg --limit 20
```

### 3. Search Working and Shared Memory
```bash
# Search across all memory layers
github-dkg search --query "consensus clocking"

# Search specifically in Shared Working Memory (SWM)
github-dkg search --query "architecture decision" --layer SWM
```

### 4. Start MCP Server
```bash
github-dkg mcp
```

---

## 🤖 Model Context Protocol (MCP) Integration

`github-dkg-engine` natively exposes 4 tools for agent runtimes:

1. `dkg_search_memory`: Search cross-layer repository context, decisions, and past bug fixes.
2. `dkg_ingest_pr`: Ingest specific pull requests directly from an active agent session into Working Memory.
3. `dkg_promote_decision`: Curator-authenticated promotion of high-signal architecture decisions from WM to Shared Working Memory.
4. `dkg_get_provenance`: Retrieve W3C PROV-O provenance graph and commit validation for any assertion.

### Configuration for Claude Desktop / Claude Code
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "github-dkg": {
      "command": "npx",
      "args": ["-y", "@buildwithpnj/github-dkg-engine@0.1.0", "mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "DKG_API_URL": "http://localhost:9200"
      }
    }
  }
}
```

### Configuration for Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "github-dkg": {
      "command": "npx",
      "args": ["-y", "@buildwithpnj/github-dkg-engine@0.1.0", "mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "DKG_API_URL": "http://localhost:9200"
      }
    }
  }
}
```

---

## 🔒 Security & Invariant Guarantees

1. **Zero Secret Leakage**: All raw markdown and diff content passes through strict regex scrubbers replacing API keys, private keys, and bearer tokens with redaction placeholders.
2. **Deterministic Cryptographic Digests**: Assets promoted through the Curator Gate receive a canonical SHA-256 digest over their structural and narrative content.
3. **Single-Consume Promotion Invariant**: Prevents duplicate assertion promotion or state mutation races in Shared Working Memory.
4. **Constrained Network Egress**: Strictly communicates with `api.github.com` and `localhost:9200`. Zero external analytics or telemetry.
5. **No Lifecycle Scripts**: Package distribution contains zero `preinstall`, `install`, or `postinstall` scripts.

---

## 🧪 Verification & Testing

Run full test suite:
```bash
npm test
```

Expected output:
```
 ✓ tests/unit/redactor.test.ts (4 tests)
 ✓ tests/unit/curator.test.ts (5 tests)
 ✓ tests/unit/provo.test.ts (2 tests)
 ✓ tests/integration/e2e_dkg_mock.test.ts (1 test)
 ✓ tests/unit/dkg.test.ts (10 tests)

 Test Files  5 passed (5)
      Tests  22 passed (22)
```

Compile TypeScript:
```bash
npm run build
```

Run static analysis:
```bash
npm run lint
```

---

## 📄 License & Attribution

- **Author**: Prakash N. Jha (`buildwithpnj` / `callmepnj@gmail.com`)
- **License**: Apache-2.0
- **DKG Bounty Submission**: Target track: Round 1 Flagship Tier (OriginTrail DKG v10 Integrations Registry)
