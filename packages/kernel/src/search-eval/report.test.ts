import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { buildReport } from "./report.js";
import type { EvalMetrics, EvalScope, EvalThresholds, QueryEvalDetail } from "./types.js";

const thresholds: EvalThresholds = {
  recall: Decimal.fromString("0.5"),
  precision: Decimal.fromString("0.5"),
};

const metrics: EvalMetrics = {
  truePositive: 1,
  falsePositive: 0,
  falseNegative: 1,
  totalRelevant: 2,
  totalReturned: 1,
  recall: Decimal.fromString("0.8"),
  precision: Decimal.fromString("0.2"),
};

const details: readonly QueryEvalDetail[] = [
  {
    queryId: "p1",
    sampleType: "positive",
    relevantCount: 2,
    returnedCount: 1,
    returnedRelevantCount: 1,
    falsePositive: false,
    falseNegative: true,
    failed: false,
  },
];

const scope: EvalScope = { knowledgeIds: ["kb-1"], version: "v1" };

test("报告组装：要素完整且结论正确", () => {
  const report = buildReport(metrics, details, thresholds, scope);
  assert.equal(report.metrics, metrics);
  assert.equal(report.details.length, 1);
  assert.equal(report.judgement.overall, "partial");
  assert.equal(report.conclusion, "检索质量部分达标");
  assert.deepEqual(report.scope.knowledgeIds, ["kb-1"]);
  assert.equal(report.scope.version, "v1");
  assert.ok(!Number.isNaN(Date.parse(report.generatedAt)));
});

test("报告组装：全部达标结论为达标", () => {
  const fullMetrics: EvalMetrics = {
    ...metrics,
    recall: Decimal.fromString("0.8"),
    precision: Decimal.fromString("0.8"),
  };
  const report = buildReport(fullMetrics, details, thresholds, scope);
  assert.equal(report.judgement.overall, "pass");
  assert.equal(report.conclusion, "检索质量达标");
});