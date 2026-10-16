import type { AppError } from "../types/errors.js";
import type { IndicatorSet, QualityGrade, QualityLevel, UnifiedData } from "../types/domain.js";
import { appError } from "../types/errors.js";
import { err, ok, type Result } from "../types/result.js";
import { IndicatorCalculator } from "./indicator-calculator.js";
import { ScenarioEngine, type ScenarioResult } from "./scenario-engine.js";
import { RiskGrader, type RiskReport } from "./risk-grader.js";
import type { ScenarioParams } from "../types/domain.js";

export { IndicatorCalculator } from "./indicator-calculator.js";
export { ScenarioEngine } from "./scenario-engine.js";
export { RiskGrader, DEFAULT_RISK_THRESHOLDS } from "./risk-grader.js";
export type { RiskReport, RiskSignal, RiskLevel } from "./risk-grader.js";

export function analyze(unified: UnifiedData, credibility: QualityLevel = "A"): IndicatorSet {
  return new IndicatorCalculator().analyze(unified, credibility);
}

/** 守卫版：先审数后算账 —— C 级或口径不明确时中止计算并回退治理 */
export function analyzeGuarded(unified: UnifiedData, grade: QualityGrade): Result<IndicatorSet, AppError> {
  if (grade.level === "C") {
    return err(appError("E_LOW_CREDIBILITY", "数据可信度不足（C 级），已中止计算并回退数据治理", { grade }));
  }
  return ok(analyze(unified, grade.level));
}

export function scenario(base: IndicatorSet, params: ScenarioParams): ScenarioResult {
  return new ScenarioEngine().scenario(base, params);
}

export function gradeRisk(indicators: IndicatorSet): RiskReport {
  return new RiskGrader().grade(indicators);
}