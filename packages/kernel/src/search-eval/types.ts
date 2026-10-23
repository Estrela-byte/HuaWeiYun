import type { Decimal } from "../types/decimal.js";

/** 样本类型：正样本（知识库内存在相关文档）/ 负样本（知识库内无相关文档） */
export type SampleType = "positive" | "negative";

/** 评估测试查询：标注集为真值基准（Ground Truth） */
export interface EvalQuery {
  readonly id: string;
  readonly query: string;
  readonly sampleType: SampleType;
  readonly relevantDocIds: readonly string[];
  readonly knowledgeIds?: readonly string[];
  readonly version?: string;
}

/** 评估测试集 */
export interface EvalTestSet {
  readonly queries: readonly EvalQuery[];
}

/** 达标阈值（Decimal，禁浮点） */
export interface EvalThresholds {
  readonly recall: Decimal;
  readonly precision: Decimal;
}

/** 检索来源 */
export type SearchSource = "enterprise" | "local";

/** 统一命中条目（含来源与文档唯一标识，供标注集比对） */
export interface SearchHit {
  readonly docId: string;
  readonly title: string;
  readonly snippet: string;
  readonly source: SearchSource;
  readonly relevance: Decimal;
}

/** 只读检索请求 */
export interface ReadonlySearchRequest {
  readonly query: string;
  readonly topK?: number;
  readonly knowledgeIds?: readonly string[];
}

/** 只读检索结果 */
export interface ReadonlySearchResult {
  readonly hits: readonly SearchHit[];
  readonly degraded: boolean;
  readonly emptyKnowledge: boolean;
}

/**
 * 只读查询接口：评估组件获取检索结果的唯一合法途径。
 * 仅暴露 search 方法，不声明任何可写方法，从类型层面固化"非侵入"。
 */
export interface IReadonlySearch {
  search(req: ReadonlySearchRequest): Promise<ReadonlySearchResult>;
}

/** 逐查询评估明细 */
export interface QueryEvalDetail {
  readonly queryId: string;
  readonly sampleType: SampleType;
  readonly relevantCount: number;
  readonly returnedCount: number;
  readonly returnedRelevantCount: number;
  readonly recall?: Decimal;
  readonly precision?: Decimal;
  readonly falsePositive: boolean;
  readonly falseNegative: boolean;
  readonly failed: boolean;
}

/** 整体评估指标（TP/FP/FN 为文档计数，比值为 Decimal） */
export interface EvalMetrics {
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
  readonly totalRelevant: number;
  readonly totalReturned: number;
  readonly recall?: Decimal;
  readonly precision?: Decimal;
}

/** 评估范围标识与检索版本 */
export interface EvalScope {
  readonly knowledgeIds: readonly string[];
  readonly version: string;
}

/** 达标判定 */
export interface PassJudgement {
  readonly recallPassed?: boolean;
  readonly precisionPassed?: boolean;
  readonly overall: "pass" | "fail" | "partial" | "incomputable";
}

/** 评估报告 */
export interface EvalReport {
  readonly metrics: EvalMetrics;
  readonly details: readonly QueryEvalDetail[];
  readonly judgement: PassJudgement;
  readonly conclusion: string;
  readonly scope: EvalScope;
  readonly generatedAt: string;
}