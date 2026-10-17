import type { AppError } from "../types/errors.js";
import type { IndicatorSet, QualityGrade, QualityLevel, ScenarioParams, ScenarioResult, UnifiedData } from "../types/domain.js";
import { type Result } from "../types/result.js";
import { type RiskReport } from "./risk-grader.js";
export { IndicatorCalculator } from "./indicator-calculator.js";
export { ScenarioEngine } from "./scenario-engine.js";
export { RiskGrader, DEFAULT_RISK_THRESHOLDS } from "./risk-grader.js";
export type { RiskReport, RiskSignal, RiskLevel } from "./risk-grader.js";
export declare function analyze(unified: UnifiedData, credibility?: QualityLevel): IndicatorSet;
/** 守卫版：先审数后算账 —— C 级或口径不明确时中止计算并回退治理 */
export declare function analyzeGuarded(unified: UnifiedData, grade: QualityGrade): Result<IndicatorSet, AppError>;
export declare function scenario(base: IndicatorSet, params: ScenarioParams): ScenarioResult;
export declare function gradeRisk(indicators: IndicatorSet): RiskReport;
