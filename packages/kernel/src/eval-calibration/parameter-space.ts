import { Decimal } from "../types/decimal.js";
import type { SearchPrecisionConfig } from "../knowledge/search-precision-config.js";

/** 参数候选空间：各组可选值做确定性笛卡尔积 */
export interface ParameterSearchSpace {
  readonly weightSets: readonly {
    readonly wTitle: Decimal;
    readonly wTag: Decimal;
    readonly wContent: Decimal;
  }[];
  readonly relevanceThresholds: readonly Decimal[];
  readonly scoreGapThresholds: readonly Decimal[];
  readonly maxTopKs: readonly number[];
}

/** 默认参数候选空间：覆盖不同权重/阈值/断层/返回上限，供确定性网格搜索标定 */
export const DEFAULT_PARAMETER_SEARCH_SPACE: ParameterSearchSpace = {
  weightSets: [
    { wTitle: Decimal.fromInt(20), wTag: Decimal.fromInt(8), wContent: Decimal.fromInt(1) },
    { wTitle: Decimal.fromInt(10), wTag: Decimal.fromInt(5), wContent: Decimal.fromInt(1) },
    { wTitle: Decimal.fromInt(10), wTag: Decimal.fromInt(4), wContent: Decimal.fromInt(1) },
  ],
  relevanceThresholds: [
    Decimal.fromInt(3),
    Decimal.fromInt(5),
    Decimal.fromInt(9),
    Decimal.fromInt(12),
    Decimal.fromInt(15),
    Decimal.fromInt(20),
  ],
  scoreGapThresholds: [
    Decimal.fromInt(10),
    Decimal.fromInt(25),
    Decimal.fromInt(50),
    Decimal.fromInt(100),
  ],
  maxTopKs: [3, 5, 8],
};

/**
 * 确定性笛卡尔积生成候选 SearchPrecisionConfig 组合。
 * 遍历顺序固定：权重组 → 相关度阈值 → 得分断层 → 返回上限（嵌套循环）。
 */
export function buildParameterCandidates(
  space: ParameterSearchSpace,
): readonly SearchPrecisionConfig[] {
  const result: SearchPrecisionConfig[] = [];
  for (const ws of space.weightSets) {
    for (const rt of space.relevanceThresholds) {
      for (const gap of space.scoreGapThresholds) {
        for (const topK of space.maxTopKs) {
          result.push({
            wTitle: ws.wTitle,
            wTag: ws.wTag,
            wContent: ws.wContent,
            relevanceThreshold: rt,
            scoreGapThreshold: gap,
            maxTopK: topK,
          });
        }
      }
    }
  }
  return result;
}