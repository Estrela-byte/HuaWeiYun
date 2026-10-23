import type { EvalReport } from "../search-eval/types.js";
import type { AppError } from "../types/errors.js";
import { appError } from "../types/errors.js";
import type { Result } from "../types/result.js";
import { err, ok } from "../types/result.js";

/** 召回率保障验证结论 */
export interface RecallGuardConclusion {
  readonly recallMaintained: boolean;
  readonly precisionImproved: boolean;
  readonly negativeSampleClean: boolean;
  readonly baseline: EvalReport;
  readonly optimized: EvalReport;
  readonly conclusion: string;
}

/**
 * 召回率保障验证：比对优化前后评估报告。
 * - 召回率硬约束：optimized.recall >= baseline.recall，下降返回 E_SEARCH_RECALL_DEGRADED。
 * - 负样本零误检：优化后负样本 returnedCount 须全为 0，违例返回 E_SEARCH_NEGATIVE_FP。
 * - 精确度提升：optimized.precision 显著高于 baseline.precision。
 * 指标不可计算返回 E_EVAL_INDICATOR_INCOMPUTABLE。
 */
export function validateRecallGuard(
  baseline: EvalReport,
  optimized: EvalReport,
): Result<RecallGuardConclusion, AppError> {
  const bRecall = baseline.metrics.recall;
  const oRecall = optimized.metrics.recall;
  const bPrecision = baseline.metrics.precision;
  const oPrecision = optimized.metrics.precision;

  if (bRecall === undefined || oRecall === undefined) {
    return err(appError("E_EVAL_INDICATOR_INCOMPUTABLE", "召回率指标不可计算", {}));
  }

  const recallMaintained = oRecall.gte(bRecall);
  if (!recallMaintained) {
    return err(
      appError("E_SEARCH_RECALL_DEGRADED", `召回率下降: ${bRecall.toString()} → ${oRecall.toString()}`, {
        baseline: bRecall.toString(),
        optimized: oRecall.toString(),
      }),
    );
  }

  const negativeSampleClean = optimized.details
    .filter((d) => d.sampleType === "negative")
    .every((d) => d.returnedCount === 0);
  if (!negativeSampleClean) {
    return err(appError("E_SEARCH_NEGATIVE_FP", "优化引入负样本误检", {}));
  }

  const precisionImproved =
    bPrecision !== undefined && oPrecision !== undefined && oPrecision.gt(bPrecision);

  const conclusion = `召回率维持 ${oRecall.toString()}（基线 ${bRecall.toString()}），精确度${
    precisionImproved
      ? `提升 ${bPrecision?.toString() ?? "N/A"} → ${oPrecision?.toString() ?? "N/A"}`
      : "未显著提升"
  }，负样本${negativeSampleClean ? "零误检" : "存在误检"}`;

  return ok({
    recallMaintained,
    precisionImproved,
    negativeSampleClean,
    baseline,
    optimized,
    conclusion,
  });
}