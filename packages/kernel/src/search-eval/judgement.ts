import type { EvalMetrics, EvalThresholds, PassJudgement } from "./types.js";

/**
 * 达标判定：用 Decimal.gte 比较整体指标与阈值。
 * 指标不可计算时对应 passed 不产出，overall 标记 "incomputable"。
 */
export function judgePass(metrics: EvalMetrics, thresholds: EvalThresholds): PassJudgement {
  const recallPassed = metrics.recall !== undefined ? metrics.recall.gte(thresholds.recall) : undefined;
  const precisionPassed =
    metrics.precision !== undefined ? metrics.precision.gte(thresholds.precision) : undefined;

  let overall: PassJudgement["overall"];
  if (recallPassed === undefined || precisionPassed === undefined) {
    overall = "incomputable";
  } else if (recallPassed && precisionPassed) {
    overall = "pass";
  } else if (!recallPassed && !precisionPassed) {
    overall = "fail";
  } else {
    overall = "partial";
  }

  return {
    ...(recallPassed !== undefined ? { recallPassed } : {}),
    ...(precisionPassed !== undefined ? { precisionPassed } : {}),
    overall,
  };
}