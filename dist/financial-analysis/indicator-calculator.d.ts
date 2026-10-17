import type { IndicatorSet, MetricDictionary, QualityLevel, UnifiedData } from "../types/domain.js";
/** 指标计算器：纯确定性函数，每个指标附公式、口径、时点与可信度 */
export declare class IndicatorCalculator {
    private dictionary;
    private caliber;
    constructor(dictionary?: MetricDictionary);
    analyze(unified: UnifiedData, credibility?: QualityLevel): IndicatorSet;
    private ratio;
    private turnover;
    private sum;
    private periodOf;
}
