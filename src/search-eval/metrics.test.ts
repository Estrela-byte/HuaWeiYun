import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { computeMetrics, statConfusion } from "./metrics.js";
import type { SearchHit } from "./types.js";

function hit(docId: string): SearchHit {
  return { docId, title: docId, snippet: "", source: "enterprise", relevance: Decimal.fromInt(1) };
}

test("混淆统计：正样本部分命中产出漏检与召回率", () => {
  const d = statConfusion({
    queryId: "p1",
    sampleType: "positive",
    relevantDocIds: ["d1", "d2"],
    hits: [hit("d1")],
    failed: false,
  });
  assert.equal(d.returnedRelevantCount, 1);
  assert.equal(d.falseNegative, true);
  assert.equal(d.falsePositive, false);
  assert.ok(d.recall?.eq(Decimal.fromString("0.5")));
  assert.ok(d.precision?.eq(Decimal.fromString("1")));
});

test("混淆统计：负样本返回非空判定为误检", () => {
  const d = statConfusion({
    queryId: "n1",
    sampleType: "negative",
    relevantDocIds: [],
    hits: [hit("x")],
    failed: false,
  });
  assert.equal(d.falsePositive, true);
  assert.equal(d.falseNegative, false);
  assert.equal(d.recall, undefined);
});

test("混淆统计：负样本空命中为正确结果", () => {
  const d = statConfusion({
    queryId: "n1",
    sampleType: "negative",
    relevantDocIds: [],
    hits: [],
    failed: false,
  });
  assert.equal(d.falsePositive, false);
  assert.equal(d.precision, undefined);
});

test("指标计算：整体召回率与精确度基于全量汇总", () => {
  const details = [
    statConfusion({ queryId: "p1", sampleType: "positive", relevantDocIds: ["d1", "d2"], hits: [hit("d1")], failed: false }),
    statConfusion({ queryId: "n1", sampleType: "negative", relevantDocIds: [], hits: [], failed: false }),
  ];
  const m = computeMetrics(details);
  assert.equal(m.truePositive, 1);
  assert.equal(m.falsePositive, 0);
  assert.equal(m.falseNegative, 1);
  assert.equal(m.totalRelevant, 2);
  assert.equal(m.totalReturned, 1);
  assert.ok(m.recall?.eq(Decimal.fromString("0.5")));
  assert.ok(m.precision?.eq(Decimal.fromString("1")));
});

test("指标计算：比值精确到 6 位小数", () => {
  const details = [
    statConfusion({
      queryId: "p1",
      sampleType: "positive",
      relevantDocIds: ["d1", "d2", "d3"],
      hits: [hit("d1"), hit("d2")],
      failed: false,
    }),
  ];
  const m = computeMetrics(details);
  assert.ok(m.recall?.eq(Decimal.fromString("0.666666")));
});

test("指标计算：无正样本时召回率不产出（除零跳过）", () => {
  const m = computeMetrics([
    statConfusion({ queryId: "n1", sampleType: "negative", relevantDocIds: [], hits: [], failed: false }),
  ]);
  assert.equal(m.totalRelevant, 0);
  assert.equal(m.recall, undefined);
  assert.equal(m.precision, undefined);
});

test("指标计算：无返回结果时精确度不产出（除零跳过）", () => {
  const m = computeMetrics([
    statConfusion({ queryId: "p1", sampleType: "positive", relevantDocIds: ["d1"], hits: [], failed: false }),
  ]);
  assert.equal(m.totalRelevant, 1);
  assert.equal(m.totalReturned, 0);
  assert.notEqual(m.recall, undefined);
  assert.equal(m.precision, undefined);
});

test("指标计算：失败样本不参与指标计算", () => {
  const m = computeMetrics([
    statConfusion({ queryId: "p1", sampleType: "positive", relevantDocIds: ["d1"], hits: [hit("d1")], failed: false }),
    {
      queryId: "p2",
      sampleType: "positive",
      relevantCount: 5,
      returnedCount: 0,
      returnedRelevantCount: 0,
      falsePositive: false,
      falseNegative: true,
      failed: true,
    },
  ]);
  assert.equal(m.totalRelevant, 1);
  assert.equal(m.truePositive, 1);
  assert.ok(m.recall?.eq(Decimal.fromString("1")));
});