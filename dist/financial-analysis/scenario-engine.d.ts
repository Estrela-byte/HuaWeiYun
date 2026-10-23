import type { IndicatorSet, ScenarioParams, ScenarioResult } from "../types/domain.js";
/** 情景测算引擎：基于假设参数做敏感性测算，强制标注为推断 */
export declare class ScenarioEngine {
    scenario(base: IndicatorSet, params: ScenarioParams): ScenarioResult;
    private projectRevenue;
    private rebuild;
    private find;
}
