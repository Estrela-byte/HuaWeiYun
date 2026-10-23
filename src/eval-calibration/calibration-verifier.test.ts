import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { DEFAULT_DOCS, DEFAULT_SEARCH_PRECISION_CONFIG } from "../knowledge/index.js";
import type { EvalTestSet } from "../search-eval/index.js";
import {
  calibrateParameters,
  DEFAULT_CALIBRATION_TARGET,
  DEFAULT_ENHANCED_TEST_SET,
  verifyCalibration,
} from "./index.js";
import type { EnhancedTestSet } from "./types.js";

const baselineTestSet: EvalTestSet = {
  queries: [
    { id: "p1", query: "毛利率的定义和计算公式", sampleType: "positive", relevantDocIds: ["kpi-gross-margin"] },
    { id: "n1", query: "如何制作提拉米苏蛋糕", sampleType: "negative", relevantDocIds: [] },
  ],
};

test("verifyCalibration: 基线满分 → 校准后落入区间的前后对比", async () => {
  const calib = await calibrateParameters(
    DEFAULT_ENHANCED_TEST_SET,
    DEFAULT_DOCS,
    DEFAULT_CALIBRATION_TARGET,
  );
  assert.ok(calib.ok, "标定应成功");
  if (!calib.ok) {
    return;
  }

  const result = await verifyCalibration(
    baselineTestSet,
    DEFAULT_ENHANCED_TEST_SET,
    DEFAULT_SEARCH_PRECISION_CONFIG,
    calib.value.config,
    DEFAULT_DOCS,
    DEFAULT_CALIBRATION_TARGET,
  );
  assert.ok(result.ok, "校准验证应成功");
  if (!result.ok) {
    return;
  }
  const c = result.value;
  assert.equal(c.inTargetRange, true);
  assert.equal(c.discriminability.discriminable, true);
  assert.ok(c.baseline.recall?.eq(Decimal.fromInt(1)), "基线召回率应为满分");
  assert.ok(c.baseline.precision?.eq(Decimal.fromInt(1)), "基线精准度应为满分");
  assert.ok(c.calibrated.recall !== undefined, "校准后召回率应可计算");
  assert.ok(c.calibrated.precision !== undefined, "校准后精准度应可计算");
  assert.ok(typeof c.conclusion === "string" && c.conclusion.length > 0);
});

test("verifyCalibration: 校准后仍为满分判区分度不足", async () => {
  const perfectSet: EnhancedTestSet = {
    queries: [
      { id: "p1", query: "毛利率的定义和计算公式", sampleType: "positive", sampleKind: "direct", relevantDocIds: ["kpi-gross-margin"] },
      { id: "n1", query: "如何制作提拉米苏蛋糕", sampleType: "negative", sampleKind: "irrelevant", relevantDocIds: [] },
    ],
  };
  const result = await verifyCalibration(
    baselineTestSet,
    perfectSet,
    DEFAULT_SEARCH_PRECISION_CONFIG,
    DEFAULT_SEARCH_PRECISION_CONFIG,
    DEFAULT_DOCS,
    DEFAULT_CALIBRATION_TARGET,
  );
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  assert.equal(result.value.discriminability.reason, "perfect_score");
  assert.match(result.value.conclusion, /满分|区分度不足/);
});

test("verifyCalibration: 非法基线测试集传播 E_EVAL_INVALID_TESTSET", async () => {
  const invalidBaseline: EvalTestSet = {
    queries: [
      { id: "p1", query: "毛利率", sampleType: "positive", relevantDocIds: [] },
    ],
  };
  const result = await verifyCalibration(
    invalidBaseline,
    DEFAULT_ENHANCED_TEST_SET,
    DEFAULT_SEARCH_PRECISION_CONFIG,
    DEFAULT_SEARCH_PRECISION_CONFIG,
    DEFAULT_DOCS,
    DEFAULT_CALIBRATION_TARGET,
  );
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.error.code, "E_EVAL_INVALID_TESTSET");
  }
});