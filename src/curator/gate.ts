import { TriModalKnowledgeAsset } from '../types/index.js';
import crypto from 'crypto';

export interface PromotionEligibilityResult {
  eligible: boolean;
  reason: string;
  assetDigest: string;
  promoterIdentity?: string;
}

export interface CuratorPolicy {
  allowedPromoters?: string[];
  requireArchitectureTag?: boolean;
  minContentLength?: number;
}

export class CuratorGate {
  private policy: CuratorPolicy;
  private consumedPromotions: Set<string> = new Set();

  constructor(policy: CuratorPolicy = {}) {
    this.policy = {
      requireArchitectureTag: false,
      minContentLength: 50,
      ...policy
    };
  }

  /**
   * Computes a deterministic SHA-256 digest of the Knowledge Asset content and structural triples.
   */
  public static computeDigest(asset: TriModalKnowledgeAsset): string {
    const hash = crypto.createHash('sha256');
    hash.update(asset.name);
    hash.update(asset.contextGraphId);
    hash.update(asset.narrativeMarkdown);
    hash.update(asset.structuralTriples);
    return hash.digest('hex');
  }

  /**
   * Evaluates whether a Working Memory asset meets the policy to be promoted to Shared Working Memory.
   */
  public evaluateEligibility(
    asset: TriModalKnowledgeAsset,
    promoterIdentity?: string
  ): PromotionEligibilityResult {
    const digest = CuratorGate.computeDigest(asset);

    // Check if already promoted in this session
    const receiptKey = `${asset.name}:${digest}`;
    if (this.consumedPromotions.has(receiptKey)) {
      return {
        eligible: false,
        reason: 'Asset version has already been promoted to Shared Memory.',
        assetDigest: digest
      };
    }

    // Minimum content quality check
    if (asset.narrativeMarkdown.length < (this.policy.minContentLength || 50)) {
      return {
        eligible: false,
        reason: `Asset content too short (${asset.narrativeMarkdown.length} chars) to represent substantive engineering knowledge.`,
        assetDigest: digest
      };
    }

    // Check architecture tag policy if enforced
    if (this.policy.requireArchitectureTag && !asset.metadata.isArchitectureDecision) {
      return {
        eligible: false,
        reason: 'Policy requires "architecture-decision" tag or ADR classification for Shared Memory promotion.',
        assetDigest: digest
      };
    }

    // Check promoter allowlist if configured
    if (this.policy.allowedPromoters && this.policy.allowedPromoters.length > 0) {
      if (!promoterIdentity || !this.policy.allowedPromoters.includes(promoterIdentity)) {
        return {
          eligible: false,
          reason: `Promoter identity "${promoterIdentity || 'anonymous'}" is not in the authorized curator allowlist.`,
          assetDigest: digest
        };
      }
    }

    return {
      eligible: true,
      reason: 'Asset satisfies all Curator Gate invariants for Shared Memory promotion.',
      assetDigest: digest,
      promoterIdentity
    };
  }

  /**
   * Records a consumed promotion receipt.
   */
  public recordPromotion(asset: TriModalKnowledgeAsset, digest: string): void {
    const receiptKey = `${asset.name}:${digest}`;
    this.consumedPromotions.add(receiptKey);
  }
}
