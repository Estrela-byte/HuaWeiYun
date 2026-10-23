import type { EvalQuery, EvalTestSet } from "../search-eval/types.js";
import type { CalibrationQuery, EnhancedTestSet } from "./types.js";

/**
 * 增强测试集映射为 search_eval 的 EvalTestSet：剥离 sampleKind，
 * 其余字段（id/query/sampleType/relevantDocIds/knowledgeIds/version）原样保留。
 * 纯映射，不校验、不抛错，供 evaluate 无改造消费。
 */
export function toEvalTestSet(testSet: EnhancedTestSet): EvalTestSet {
  const queries: EvalQuery[] = testSet.queries.map((q) => ({
    id: q.id,
    query: q.query,
    sampleType: q.sampleType,
    relevantDocIds: q.relevantDocIds,
    ...(q.knowledgeIds !== undefined ? { knowledgeIds: q.knowledgeIds } : {}),
    ...(q.version !== undefined ? { version: q.version } : {}),
  }));
  return { queries };
}

/**
 * 预置增强测试集：基于 DEFAULT_DOCS 的 9 篇经营领域文档构造。
 * 覆盖六类样本，使指标真实且有区分度（直接/口语化/同义改写正样本、
 * 无关/干扰负样本、边界样本）。标注集完备且指向真实文档。
 */
export const DEFAULT_ENHANCED_TEST_SET: EnhancedTestSet = {
  queries: [
    // —— 直接正样本：query 直接命中标题/标签 ——
    { id: "d1", query: "毛利率的定义和计算公式", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["kpi-gross-margin"] },
    { id: "d2", query: "盈亏平衡点如何计算", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["kpi-break-even"] },
    { id: "d3", query: "净利率的计算公式", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["kpi-net-margin"] },
    { id: "d4", query: "现金流管理有哪些要点", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["faq-cashflow"] },
    { id: "d5", query: "费用率的计算公式", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["kpi-expense-ratio"] },
    { id: "d6", query: "利润下降的原因有哪些", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["faq-profit-decline"] },
    { id: "d7", query: "收入波动预警的规则", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["rule-revenue-fluctuation"] },

    // —— 口语化正样本：白话表达，语义指向相关文档，字面与标题不同 ——
    { id: "c1", query: "卖一单货刨去成本到底能剩多少", sampleType: "positive", sampleKind: "colloquial", relevantDocIds: ["kpi-gross-margin"] },
    { id: "c2", query: "做到多少生意才能不亏本", sampleType: "positive", sampleKind: "colloquial", relevantDocIds: ["kpi-break-even"] },

    // —— 同义改写正样本：同义/近义改写指标名，语义指向同一文档 ——
    { id: "p1", query: "毛利占营业收入的比重", sampleType: "positive", sampleKind: "paraphrase", relevantDocIds: ["kpi-gross-margin"] },
    { id: "p2", query: "净利润大概能拿到多少", sampleType: "positive", sampleKind: "paraphrase", relevantDocIds: ["kpi-net-margin"] },

    // —— 无关负样本：与经营领域无关 ——
    { id: "i1", query: "如何制作提拉米苏蛋糕", sampleType: "negative", sampleKind: "irrelevant", relevantDocIds: [] },
    { id: "i2", query: "如何饲养一只金毛犬", sampleType: "negative", sampleKind: "irrelevant", relevantDocIds: [] },

    // —— 干扰负样本：经营/财务领域内但知识库无对应答案 ——
    { id: "f1", query: "应收账款周转率怎么计算", sampleType: "negative", sampleKind: "distractor", relevantDocIds: [] },
    { id: "f2", query: "存货周转天数如何缩短", sampleType: "negative", sampleKind: "distractor", relevantDocIds: [] },

    // —— 边界样本：相关度评分落在阈值附近，命中与否依赖参数取值 ——
    { id: "b1", query: "毛利率低于多少需要警惕", sampleType: "positive", sampleKind: "boundary", relevantDocIds: ["rule-gross-margin-floor"] },
    { id: "b2", query: "成本占比超过多少会预警", sampleType: "positive", sampleKind: "boundary", relevantDocIds: ["rule-cost-ratio"] },
  ],
};