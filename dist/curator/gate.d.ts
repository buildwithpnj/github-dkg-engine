import { TriModalKnowledgeAsset } from '../types/index.js';
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
export declare class CuratorGate {
    private policy;
    private consumedPromotions;
    constructor(policy?: CuratorPolicy);
    /**
     * Computes a deterministic SHA-256 digest of the Knowledge Asset content and structural triples.
     */
    static computeDigest(asset: TriModalKnowledgeAsset): string;
    /**
     * Evaluates whether a Working Memory asset meets the policy to be promoted to Shared Working Memory.
     */
    evaluateEligibility(asset: TriModalKnowledgeAsset, promoterIdentity?: string): PromotionEligibilityResult;
    /**
     * Records a consumed promotion receipt.
     */
    recordPromotion(asset: TriModalKnowledgeAsset, digest: string): void;
}
//# sourceMappingURL=gate.d.ts.map