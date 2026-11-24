#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { GitHubClient } from '../client/github.js';
import { DKGClient } from '../client/dkg.js';
import { AssetSynthesizer } from '../synthesizer/provo.js';
import { CuratorGate } from '../curator/gate.js';
import { DkgMcpServer } from '../mcp/server.js';

const program = new Command();

program
  .name('github-dkg')
  .description('Enterprise GitHub to OriginTrail DKG v10 Working Memory Engine')
  .version('0.1.0');

// Command: status
program
  .command('status')
  .description('Check connectivity to DKG node and GitHub API status')
  .action(async () => {
    console.log(chalk.bold('🔍 Checking GitHub & DKG v10 Edge Node Status...'));
    const dkg = new DKGClient();
    const gh = new GitHubClient();

    const dkgStatus = await dkg.ping();
    if (dkgStatus.status === 'ONLINE') {
      console.log(chalk.green(`  ✔ DKG Node: ONLINE (Version: ${dkgStatus.version})`));
    } else {
      console.log(chalk.red(`  ✖ DKG Node: OFFLINE (Check DKG_API_URL)`));
    }

    try {
      // test GitHub client
      console.log(chalk.green(`  ✔ GitHub Client initialized (Token: ${process.env.GITHUB_TOKEN ? 'CONFIGURED' : 'ANONYMOUS/PUBLIC'})`));
    } catch (e: any) {
      console.log(chalk.yellow(`  ⚠ GitHub: ${e.message}`));
    }
  });

// Command: ingest
program
  .command('ingest <repo>')
  .description('Ingest GitHub pull request or issue into DKG Working Memory')
  .option('-p, --pr <number>', 'Specific pull request number to ingest')
  .option('-i, --issue <number>', 'Specific issue number to ingest')
  .option('-g, --graph <id>', 'Target Context Graph ID', 'engineering-default')
  .option('--promote', 'Promote eligible architectural decisions to Shared Memory', false)
  .action(async (repoStr, options) => {
    const [owner, repo] = repoStr.split('/');
    if (!owner || !repo) {
      console.error(chalk.red('Error: repo must be in the format "owner/repo"'));
      process.exit(1);
    }

    const gh = new GitHubClient();
    const dkg = new DKGClient();
    const curator = new CuratorGate();

    console.log(chalk.cyan(`📥 Ingesting from ${owner}/${repo} into DKG Context Graph [${options.graph}]...`));

    // Ensure context graph exists
    await dkg.createContextGraph(options.graph, `GitHub: ${owner}/${repo}`);

    if (options.pr) {
      const prNumber = parseInt(options.pr, 10);
      console.log(chalk.blue(`  Fetching Pull Request #${prNumber}...`));
      const pr = await gh.getPullRequest(owner, repo, prNumber);
      const asset = AssetSynthesizer.synthesizePullRequestAsset(owner, repo, pr, options.graph, 'WM');

      console.log(chalk.gray(`  Writing Knowledge Asset to Working Memory turn...`));
      const turnRes = await dkg.recordMemoryTurn({
        agentId: 'github-dkg-cli',
        contextGraphId: options.graph,
        turnContent: `Ingested GitHub PR #${pr.number}: ${pr.title}`,
        assertions: [{ name: asset.name, content: asset.structuralTriples, format: 'turtle' }]
      });

      console.log(chalk.green(`  ✔ Stored in Working Memory! (Turn ID: ${turnRes.turnId})`));

      if (options.promote) {
        const eligibility = curator.evaluateEligibility(asset, 'curator:cli');
        if (eligibility.eligible) {
          console.log(chalk.magenta(`  🌟 Promoting architectural decision to Shared Working Memory (SWM)...`));
          await dkg.promoteToSharedMemory({
            assertionName: asset.name,
            targetContextGraphId: options.graph,
            promoterIdentity: 'curator:cli'
          });
          console.log(chalk.green(`  ✔ Promoted to Shared Working Memory successfully!`));
        } else {
          console.log(chalk.yellow(`  ℹ SWM Promotion skipped: ${eligibility.reason}`));
        }
      }
    } else {
      console.log(chalk.yellow('Listing recent PRs for batch ingestion...'));
      const prs = await gh.listPullRequests(owner, repo, 'all', 5);
      for (const pr of prs) {
        console.log(`  - #${pr.number}: ${pr.title}`);
      }
      console.log(chalk.gray('Use --pr <number> to ingest specific items.'));
    }
  });

// Command: search
program
  .command('search <query>')
  .description('Search repository knowledge in DKG Working and Shared Memory')
  .option('-g, --graph <id>', 'Filter by Context Graph ID')
  .option('-l, --limit <number>', 'Number of results', '5')
  .action(async (query, options) => {
    console.log(chalk.cyan(`🔎 Searching DKG memory for: "${query}"...`));
    const dkg = new DKGClient();
    const results = await dkg.searchMemory({
      query,
      contextGraphId: options.graph,
      limit: parseInt(options.limit, 10)
    });

    if (results.length === 0) {
      console.log(chalk.yellow('No matching knowledge assets found in memory layers.'));
      return;
    }

    console.log(chalk.green(`Found ${results.length} results:`));
    for (const r of results) {
      console.log(chalk.bold(`\n[${r.memoryLayer}] ${r.assertionId} (Score: ${r.score})`));
      console.log(chalk.gray(`Context Graph: ${r.contextGraphId}`));
      console.log(r.content.slice(0, 200) + '...');
    }
  });

// Command: mcp
program
  .command('mcp')
  .description('Start Model Context Protocol (MCP) server on stdio')
  .action(async () => {
    const server = new DkgMcpServer();
    await server.start();
  });

program.parse(process.argv);
