import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { evaluate } from "../search-eval/index.js";
import type { EvalTestSet, EvalThresholds } from "../search-eval/index.js";
import {
  DEFAULT_DOCS,
  DEFAULT_SEARCH_PRECISION_CONFIG,
  KnowledgeBase,
  validateRecallGuard,
  type SearchPrecisionConfig,
} from "./index.js";
import { KnowledgeReadonlySearchAdapter } from "./readonly-search-adapter.js";

/** 优化前等价配置：10/5/1 评分，无阈值过滤（threshold=1），无断层截断（gap=9999），top5 */
const baselineConfig: SearchPrecisionConfig = {
  wTitle: Decimal.fromInt(10),
  wTag: Decimal.fromInt(5),
  wContent: Decimal.fromInt(1),
  relevanceThreshold: Decimal.fromInt(1),
  scoreGapThreshold: Decimal.fromInt(9999),
  maxTopK: 5,
};

const thresholds: EvalThresholds = {
  recall: Decimal.fromString("0.5"),
  precision: Decimal.fromString("0.5"),
};

const testSet: EvalTestSet = {
  queries: [
    { id: "p1", query: "毛利率的定义和计算公式", sampleType: "positive", relevantDocIds: ["kpi-gross-margin"] },
    { id: "p2", query: "利润下降有哪些原因怎么应对", sampleType: "positive", relevantDocIds: ["faq-profit-decline"] },
    { id: "p3", query: "现金流管理的关键指标与对策", sampleType: "positive", relevantDocIds: ["faq-cashflow"] },
    { id: "n1", query: "如何制作提拉米苏蛋糕", sampleType: "negative", relevantDocIds: [] },
  ],
};

test("端到端复测：优化后召回率维持且精确度显著提升", async () => {
  const baselineKb = new KnowledgeBase(DEFAULT_DOCS, baselineConfig);
  const optimizedKb = new KnowledgeBase(DEFAULT_DOCS, DEFAULT_SEARCH_PRECISION_CONFIG);

  const baselineResult = await evaluate(
    testSet,
    thresholds,
    new KnowledgeReadonlySearchAdapter(baselineKb),
  );
  const optimizedResult = await evaluate(
    testSet,
    thresholds,
    new KnowledgeReadonlySearchAdapter(optimizedKb),
  );

  assert.ok(baselineResult.ok, "基线评估应成功");
  assert.ok(optimizedResult.ok, "优化后评估应成功");
  if (!baselineResult.ok || !optimizedResult.ok) {
    return;
  }

  const baseline = baselineResult.value;
  const optimized = optimizedResult.value;

  assert.ok(baseline.metrics.recall?.eq(Decimal.fromString("1")), "基线召回率应为 1");
  assert.ok(
    baseline.metrics.precision?.eq(Decimal.fromString("0.2")),
    `基线精确度应为 0.2，实际 ${baseline.metrics.precision?.toString()}`,
  );

  const guard = validateRecallGuard(baseline, optimized);
  assert.ok(guard.ok, "召回率保障验证应通过");
  if (guard.ok) {
    assert.equal(guard.value.recallMaintained, true, "召回率须维持");
    assert.equal(guard.value.precisionImproved, true, "精确度须提升");
    assert.equal(guard.value.negativeSampleClean, true, "负样本须零误检");
  }
});