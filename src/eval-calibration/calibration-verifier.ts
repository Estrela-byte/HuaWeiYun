import { AuditLogger } from "../shared/audit.js";
import { KnowledgeBase } from "../knowledge/knowledge-base.js";
import { KnowledgeReadonlySearchAdapter } from "../knowledge/readonly-search-adapter.js";
import type { SearchPrecisionConfig } from "../knowledge/search-precision-config.js";
import { evaluate } from "../search-eval/evaluator.js";
import type { EvalTestSet, EvalThresholds } from "../search-eval/types.js";
import type { AppError } from "../types/errors.js";
import type { KnowledgeDoc } from "../types/knowledge.js";
import type { Result } from "../types/result.js";
import { err, ok } from "../types/result.js";
import { checkDiscriminability, type DiscriminabilityResult } from "./discriminability.js";
import { toEvalTestSet } from "./enhanced-testset.js";
import type { CalibrationTarget } from "./target-range.js";
import { inTargetRange } from "./target-range.js";
import type { EnhancedTestSet, MetricSnapshot } from "./types.js";

/** 校准验证结论：校准前后指标快照 + 达标/区分度判定 + 参数快照 + 中文结论 */
export interface CalibrationConclusion {
  readonly baseline: MetricSnapshot;
  readonly calibrated: MetricSnapshot;
  readonly inTargetRange: boolean;
  readonly discriminability: DiscriminabilityResult;
  readonly calibratedConfig: SearchPrecisionConfig;
  readonly target: CalibrationTarget;
  readonly conclusion: string;
}

function buildConclusion(
  calibrated: MetricSnapshot,
  inRange: boolean,
  disc: DiscriminabilityResult,
  target: CalibrationTarget,
): string {
  const recallStr = calibrated.recall?.toString() ?? "不可计算";
  const precisionStr = calibrated.precision?.toString() ?? "不可计算";
  const rangeStr = `[${target.recallLower.toString()}, ${target.recallUpper.toString()}]`;
  if (disc.reason === "incomputable") {
    return "校准后指标不可计算，无法判定校准效果";
  }
  if (disc.reason === "perfect_score") {
    return "校准后指标仍为满分，测试集区分度不足，请继续增强样本";
  }
  if (disc.reason === "all_zero") {
    return "校准后指标全零，测试集过难或参数过严，请回调参数或调整样本难度";
  }
  if (inRange) {
    return `校准后召回率 ${recallStr}、精准度 ${precisionStr} 均落入 ${rangeStr} 目标区间且具备区分度，校准成功`;
  }
  return `校准后召回率 ${recallStr}、精准度 ${precisionStr} 未落入 ${rangeStr} 目标区间，请继续调整参数或测试集难度`;
}

/**
 * 校准验证编排：复用 evaluate 分别测算基线（旧测试集 + 基线参数，呈现理想化满分）
 * 与校准后（增强测试集 + 标定参数）指标，判定校准后是否落入目标区间、区分度是否通过，
 * 产出前后对比与中文结论。全程仅经 IReadonlySearch 只读采集，不自动回写线上参数。
 */
export async function verifyCalibration(
  baselineTestSet: EvalTestSet,
  calibratedTestSet: EnhancedTestSet,
  baselineConfig: SearchPrecisionConfig,
  calibratedConfig: SearchPrecisionConfig,
  docs: readonly KnowledgeDoc[],
  target: CalibrationTarget,
): Promise<Result<CalibrationConclusion, AppError>> {
  const audit = new AuditLogger();
  const thresholds: EvalThresholds = { recall: target.recallLower, precision: target.precisionLower };

  const baselineResult = await evaluate(
    baselineTestSet,
    thresholds,
    new KnowledgeReadonlySearchAdapter(new KnowledgeBase([...docs], baselineConfig)),
  );
  if (!baselineResult.ok) {
    return err(baselineResult.error);
  }

  const calibratedResult = await evaluate(
    toEvalTestSet(calibratedTestSet),
    thresholds,
    new KnowledgeReadonlySearchAdapter(new KnowledgeBase([...docs], calibratedConfig)),
  );
  if (!calibratedResult.ok) {
    return err(calibratedResult.error);
  }

  const baseline: MetricSnapshot = {
    ...(baselineResult.value.metrics.recall !== undefined ? { recall: baselineResult.value.metrics.recall } : {}),
    ...(baselineResult.value.metrics.precision !== undefined
      ? { precision: baselineResult.value.metrics.precision }
      : {}),
  };
  const calibrated: MetricSnapshot = {
    ...(calibratedResult.value.metrics.recall !== undefined
      ? { recall: calibratedResult.value.metrics.recall }
      : {}),
    ...(calibratedResult.value.metrics.precision !== undefined
      ? { precision: calibratedResult.value.metrics.precision }
      : {}),
  };

  const inRange = inTargetRange(calibrated.recall, calibrated.precision, target);
  const discriminability = checkDiscriminability(calibrated.recall, calibrated.precision);
  const conclusion = buildConclusion(calibrated, inRange, discriminability, target);

  audit.log(
    "eval_calibration.verify",
    "success",
    "default",
    `baseline recall=${baseline.recall?.toString() ?? "N/A"} precision=${baseline.precision?.toString() ?? "N/A"} ` +
      `calibrated recall=${calibrated.recall?.toString() ?? "N/A"} precision=${calibrated.precision?.toString() ?? "N/A"} ` +
      `inRange=${inRange} discriminable=${discriminability.discriminable}`,
  );

  return ok({
    baseline,
    calibrated,
    inTargetRange: inRange,
    discriminability,
    calibratedConfig,
    target,
    conclusion,
  });
}