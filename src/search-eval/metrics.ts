import { Decimal } from "../types/decimal.js";
import type { EvalMetrics, QueryEvalDetail, SampleType, SearchHit } from "./types.js";

/** 指标比值固定小数位（设计 1.2.1 建议 scale=6） */
const METRIC_SCALE = 6;

/** 逐查询混淆统计的输入：标注集 + 只读采集到的命中列表 */
export interface ConfusionInput {
  readonly queryId: string;
  readonly sampleType: SampleType;
  readonly relevantDocIds: readonly string[];
  readonly hits: readonly SearchHit[];
  readonly failed: boolean;
}

/**
 * 逐查询比对标注集与返回命中，产出 TP/漏检/误检与逐查询召回率、精确度。
 * 该查询分母为零时对应比值字段不产出（除零跳过）。
 */
export function statConfusion(input: ConfusionInput): QueryEvalDetail {
  const relevantSet = new Set(input.relevantDocIds);
  const returnedDocIds = input.hits.map((h) => h.docId);

  const relevantCount = input.relevantDocIds.length;
  const returnedCount = input.hits.length;
  let returnedRelevantCount = 0;
  for (const docId of returnedDocIds) {
    if (relevantSet.has(docId)) {
      returnedRelevantCount += 1;
    }
  }

  const falsePositive =
    input.sampleType === "negative" ? returnedCount > 0 : returnedRelevantCount < returnedCount;
  const falseNegative = relevantCount > 0 && returnedRelevantCount < relevantCount;

  const recall =
    relevantCount > 0
      ? Decimal.fromInt(returnedRelevantCount).div(Decimal.fromInt(relevantCount), METRIC_SCALE)
      : undefined;
  const precision =
    returnedCount > 0
      ? Decimal.fromInt(returnedRelevantCount).div(Decimal.fromInt(returnedCount), METRIC_SCALE)
      : undefined;

  return {
    queryId: input.queryId,
    sampleType: input.sampleType,
    relevantCount,
    returnedCount,
    returnedRelevantCount,
    ...(recall !== undefined ? { recall } : {}),
    ...(precision !== undefined ? { precision } : {}),
    falsePositive,
    falseNegative,
    failed: input.failed,
  };
}

/**
 * 基于全量查询明细汇总整体指标（非逐查询平均）。
 * 召回率 = TP / 标注相关文档总数；精确度 = TP / 返回文档总数。
 * 分母为零时对应指标不产出（除零跳过，禁止抛错）。失败样本不参与指标计算。
 */
export function computeMetrics(details: readonly QueryEvalDetail[]): EvalMetrics {
  let truePositive = 0;
  let totalRelevant = 0;
  let totalReturned = 0;

  for (const d of details) {
    if (d.failed) {
      continue;
    }
    truePositive += d.returnedRelevantCount;
    totalRelevant += d.relevantCount;
    totalReturned += d.returnedCount;
  }

  const falsePositive = totalReturned - truePositive;
  const falseNegative = totalRelevant - truePositive;

  const recall =
    totalRelevant > 0
      ? Decimal.fromInt(truePositive).div(Decimal.fromInt(totalRelevant), METRIC_SCALE)
      : undefined;
  const precision =
    totalReturned > 0
      ? Decimal.fromInt(truePositive).div(Decimal.fromInt(totalReturned), METRIC_SCALE)
      : undefined;

  return {
    truePositive,
    falsePositive,
    falseNegative,
    totalRelevant,
    totalReturned,
    ...(recall !== undefined ? { recall } : {}),
    ...(precision !== undefined ? { precision } : {}),
  };
}