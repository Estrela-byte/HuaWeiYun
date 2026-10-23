import type { Decimal } from "../types/decimal.js";

/**
 * 样本细分类型：与 sampleType（positive/negative）正交，用于区分度追溯。
 * - direct / colloquial / paraphrase 为正样本细分
 * - irrelevant / distractor 为负样本细分
 * - boundary 可正可负，须结合 sampleType 判定正负
 */
export type SampleKind =
  | "direct"
  | "colloquial"
  | "paraphrase"
  | "irrelevant"
  | "distractor"
  | "boundary";

/** 增强测试查询：在 EvalQuery 基础上新增 sampleKind */
export interface CalibrationQuery {
  readonly id: string;
  readonly query: string;
  readonly sampleType: "positive" | "negative";
  readonly sampleKind: SampleKind;
  readonly relevantDocIds: readonly string[];
  readonly knowledgeIds?: readonly string[];
  readonly version?: string;
}

/** 增强测试集 */
export interface EnhancedTestSet {
  readonly queries: readonly CalibrationQuery[];
}

/** 指标快照：recall/precision 为 Decimal | undefined（不可计算时缺省，除零跳过） */
export interface MetricSnapshot {
  readonly recall?: Decimal;
  readonly precision?: Decimal;
}