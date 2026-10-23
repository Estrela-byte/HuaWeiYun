import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { validateRecallGuard } from "./recall-guard.js";
import type { EvalMetrics, EvalReport, QueryEvalDetail } from "../search-eval/types.js";

function metrics(recall?: Decimal, precision?: Decimal): EvalMetrics {
  return {
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    totalRelevant: 0,
    totalReturned: 0,
    ...(recall !== undefined ? { recall } : {}),
    ...(precision !== undefined ? { precision } : {}),
  };
}

function negDetail(returnedCount: number): QueryEvalDetail {
  return {
    queryId: "n1",
    sampleType: "negative",
    relevantCount: 0,
    returnedCount,
    returnedRelevantCount: 0,
    falsePositive: false,
    falseNegative: false,
    failed: false,
  };
}

function report(recall: Decimal, precision: Decimal, negReturned: number): EvalReport {
  return {
    metrics: metrics(recall, precision),
    details: [negDetail(negReturned)],
    judgement: { overall: "pass" },
    conclusion: "",
    scope: { knowledgeIds: [], version: "" },
    generatedAt: "",
  };
}

test("召回率验证：召回维持且精确度提升且负样本干净返回 ok", () => {
  const r = validateRecallGuard(
    report(Decimal.fromString("1"), Decimal.fromString("0.2"), 0),
    report(Decimal.fromString("1"), Decimal.fromString("1"), 0),
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.recallMaintained, true);
    assert.equal(r.value.precisionImproved, true);
    assert.equal(r.value.negativeSampleClean, true);
  }
});

test("召回率验证：召回率下降返回 E_SEARCH_RECALL_DEGRADED", () => {
  const r = validateRecallGuard(
    report(Decimal.fromString("1"), Decimal.fromString("0.2"), 0),
    report(Decimal.fromString("0.5"), Decimal.fromString("1"), 0),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_SEARCH_RECALL_DEGRADED");
  }
});

test("召回率验证：负样本误检返回 E_SEARCH_NEGATIVE_FP", () => {
  const r = validateRecallGuard(
    report(Decimal.fromString("1"), Decimal.fromString("0.2"), 0),
    report(Decimal.fromString("1"), Decimal.fromString("1"), 1),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_SEARCH_NEGATIVE_FP");
  }
});

test("召回率验证：精确度未提升标记 precisionImproved=false", () => {
  const r = validateRecallGuard(
    report(Decimal.fromString("1"), Decimal.fromString("0.5"), 0),
    report(Decimal.fromString("1"), Decimal.fromString("0.5"), 0),
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.precisionImproved, false);
  }
});