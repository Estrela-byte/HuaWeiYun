import type { HealthReport, IndicatorSet, UnifiedData } from "../types/domain.js";
import { HealthScorer } from "./health-scorer.js";
import { AnomalyDetector } from "./anomaly-detector.js";
import { RootCauseLocator } from "./root-cause-locator.js";
import { IssueGrader } from "./issue-grader.js";

export { HealthScorer, DEFAULT_WEIGHTS } from "./health-scorer.js";
export { AnomalyDetector } from "./anomaly-detector.js";
export { RootCauseLocator } from "./root-cause-locator.js";
export { IssueGrader } from "./issue-grader.js";

export interface DiagnoseOptions {
  hasHistory?: boolean;
  hasBenchmark?: boolean;
}

/** 经营诊断主入口：五维评分 → 异常识别 → 根因下钻 → 问题分级 */
export function diagnose(_data: UnifiedData, indicators: IndicatorSet, options: DiagnoseOptions = {}): HealthReport {
  const { dimensionScores, totalScore } = new HealthScorer().score(indicators);
  const anomalies = new AnomalyDetector().detect(indicators, options);
  const rootCauses = new RootCauseLocator().locate(anomalies, indicators);
  const issueGrades = new IssueGrader().grade(rootCauses);
  return { dimensionScores, totalScore, anomalies, rootCauses, issueGrades };
}