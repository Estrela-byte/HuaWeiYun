import type { DimensionScore, HealthDimension, IndicatorSet } from "../types/domain.js";
/** 五维度健康度评分器，各维度独立 0-100 分，加权合成总评 */
export declare class HealthScorer {
    score(indicators: IndicatorSet, weights?: Record<HealthDimension, number>): {
        dimensionScores: DimensionScore[];
        totalScore: number;
    };
    private profitability;
    private growth;
    private solvency;
    private efficiency;
    private cashflowScore;
}
export declare const DEFAULT_WEIGHTS: Record<HealthDimension, number>;
