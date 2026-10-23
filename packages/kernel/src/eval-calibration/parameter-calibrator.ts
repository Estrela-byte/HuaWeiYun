import { AuditLogger } from "../shared/audit.js";
import { KnowledgeBase } from "../knowledge/knowledge-base.js";
import { KnowledgeReadonlySearchAdapter } from "../knowledge/readonly-search-adapter.js";
import type { SearchPrecisionConfig } from "../knowledge/search-precision-config.js";
import { evaluate } from "../search-eval/evaluator.js";
import type { EvalThresholds } from "../search-eval/types.js";
import { Decimal } from "../types/decimal.js";
import type { AppError } from "../types/errors.js";
import { appError } from "../types/errors.js";
import type { KnowledgeDoc } from "../types/knowledge.js";
import type { Result } from "../types/result.js";
import { err, ok } from "../types/result.js";
import { checkDiscriminability } from "./discriminability.js";
import { toEvalTestSet } from "./enhanced-testset.js";
import {
  buildParameterCandidates,
  DEFAULT_PARAMETER_SEARCH_SPACE,
  type ParameterSearchSpace,
} from "./parameter-space.js";
import type { CalibrationTarget } from "./target-range.js";
import { inTargetRange } from "./target-range.js";
import { validateEnhancedTestSet } from "./testset-enhancer.js";
import type { EnhancedTestSet } from "./types.js";

/** 参数标定结果：标定参数快照 + 标定后指标 + 达标/区分度判定 */
export interface CalibrationResult {
  readonly config: SearchPrecisionConfig;
  readonly recall: Decimal;
  readonly precision: Decimal;
  readonly inTargetRange: boolean;
  readonly discriminable: boolean;
}

/** 目标区间中心（0.8），用于曼哈顿距离最小化选择 */
const TARGET_CENTER = Decimal.fromString("0.8");

/** 曼哈顿距离：|recall - center| + |precision - center|，全程 Decimal 禁浮点 */
function distanceToCenter(recall: Decimal, precision: Decimal): Decimal {
  return recall.sub(TARGET_CENTER).abs().add(precision.sub(TARGET_CENTER).abs());
}

/**
 * 参数标定（确定性网格搜索）：校验增强测试集 → 映射 EvalTestSet → 生成候选参数 →
 * 逐候选经 IReadonlySearch 只读采集并复用 evaluate 测算 → 筛选入围目标区间且区分度达标的候选 →
 * 从中选离区间中心 0.8 曼哈顿距离最小者返回。无达标候选返回 E_CALIB_NO_FEASIBLE_CONFIG。
 * 全程仅经 IReadonlySearch 只读采集，不调用任何可写方法，不引入 LLM/随机/浮点。
 */
export async function calibrateParameters(
  testSet: EnhancedTestSet,
  docs: readonly KnowledgeDoc[],
  target: CalibrationTarget,
  searchSpace: ParameterSearchSpace = DEFAULT_PARAMETER_SEARCH_SPACE,
): Promise<Result<CalibrationResult, AppError>> {
  const audit = new AuditLogger();

  const valid = validateEnhancedTestSet(testSet, docs);
  if (!valid.ok) {
    return err(valid.error);
  }

  const evalTestSet = toEvalTestSet(testSet);
  const thresholds: EvalThresholds = { recall: target.recallLower, precision: target.precisionLower };
  const candidates = buildParameterCandidates(searchSpace);

  let bestConfig: SearchPrecisionConfig | undefined;
  let bestRecall: Decimal | undefined;
  let bestPrecision: Decimal | undefined;
  let bestDistance: Decimal | undefined;

  let nearestConfig: SearchPrecisionConfig | undefined;
  let nearestRecall: Decimal | undefined;
  let nearestPrecision: Decimal | undefined;
  let nearestDistance: Decimal | undefined;

  for (const config of candidates) {
    const kb = new KnowledgeBase([...docs], config);
    const adapter = new KnowledgeReadonlySearchAdapter(kb);
    const result = await evaluate(evalTestSet, thresholds, adapter);
    if (!result.ok) {
      audit.log("eval_calibration.candidate", "failed", "default", result.error.message);
      continue;
    }
    const recall = result.value.metrics.recall;
    const precision = result.value.metrics.precision;
    audit.log(
      "eval_calibration.candidate",
      "success",
      "default",
      `recall=${recall?.toString() ?? "N/A"} precision=${precision?.toString() ?? "N/A"}`,
    );

    if (recall === undefined || precision === undefined) {
      continue;
    }

    const distance = distanceToCenter(recall, precision);
    if (nearestDistance === undefined || distance.lt(nearestDistance)) {
      nearestDistance = distance;
      nearestConfig = config;
      nearestRecall = recall;
      nearestPrecision = precision;
    }

    if (inTargetRange(recall, precision, target) && checkDiscriminability(recall, precision).discriminable) {
      if (bestDistance === undefined || distance.lt(bestDistance)) {
        bestDistance = distance;
        bestConfig = config;
        bestRecall = recall;
        bestPrecision = precision;
      }
    }
  }

  if (bestConfig === undefined || bestRecall === undefined || bestPrecision === undefined) {
    return err(
      appError("E_CALIB_NO_FEASIBLE_CONFIG", "无可行参数组合", {
        nearest:
          nearestConfig !== undefined && nearestRecall !== undefined && nearestPrecision !== undefined
            ? {
                config: nearestConfig,
                recall: nearestRecall.toString(),
                precision: nearestPrecision.toString(),
              }
            : undefined,
        suggestion: "请调整参数候选空间或增强测试集难度，使指标落入目标区间",
      }),
    );
  }

  audit.log(
    "eval_calibration.complete",
    "success",
    "default",
    `recall=${bestRecall.toString()} precision=${bestPrecision.toString()}`,
  );

  return ok({
    config: bestConfig,
    recall: bestRecall,
    precision: bestPrecision,
    inTargetRange: inTargetRange(bestRecall, bestPrecision, target),
    discriminable: checkDiscriminability(bestRecall, bestPrecision).discriminable,
  });
}