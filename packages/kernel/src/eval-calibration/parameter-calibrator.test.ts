import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { DEFAULT_DOCS } from "../knowledge/index.js";
import {
  calibrateParameters,
  DEFAULT_CALIBRATION_TARGET,
  DEFAULT_ENHANCED_TEST_SET,
  type ParameterSearchSpace,
} from "./index.js";
import type { EnhancedTestSet } from "./types.js";

test("calibrateParameters: 端到端标定落入目标区间且区分度通过", async () => {
  const result = await calibrateParameters(
    DEFAULT_ENHANCED_TEST_SET,
    DEFAULT_DOCS,
    DEFAULT_CALIBRATION_TARGET,
  );
  assert.ok(result.ok, "标定应成功");
  if (!result.ok) {
    return;
  }
  const r = result.value;
  assert.equal(r.inTargetRange, true);
  assert.equal(r.discriminable, true);
  assert.ok(r.recall.gte(Decimal.fromString("0.7")), `召回率应 ≥ 0.7，实际 ${r.recall.toString()}`);
  assert.ok(r.recall.lte(Decimal.fromString("0.9")), `召回率应 ≤ 0.9，实际 ${r.recall.toString()}`);
  assert.ok(r.precision.gte(Decimal.fromString("0.7")), `精准度应 ≥ 0.7，实际 ${r.precision.toString()}`);
  assert.ok(r.precision.lte(Decimal.fromString("0.9")), `精准度应 ≤ 0.9，实际 ${r.precision.toString()}`);
});

test("calibrateParameters: 无可行参数返回 E_CALIB_NO_FEASIBLE_CONFIG", async () => {
  const narrowSpace: ParameterSearchSpace = {
    weightSets: [{ wTitle: Decimal.fromInt(20), wTag: Decimal.fromInt(8), wContent: Decimal.fromInt(1) }],
    relevanceThresholds: [Decimal.fromInt(1)],
    scoreGapThresholds: [Decimal.fromInt(9999)],
    maxTopKs: [10],
  };
  const result = await calibrateParameters(
    DEFAULT_ENHANCED_TEST_SET,
    DEFAULT_DOCS,
    DEFAULT_CALIBRATION_TARGET,
    narrowSpace,
  );
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.error.code, "E_CALIB_NO_FEASIBLE_CONFIG");
  }
});

test("calibrateParameters: 校验失败传播对应错误码", async () => {
  const queries = DEFAULT_ENHANCED_TEST_SET.queries.filter((q) => q.sampleKind !== "colloquial");
  const testSet: EnhancedTestSet = { queries };
  const result = await calibrateParameters(testSet, DEFAULT_DOCS, DEFAULT_CALIBRATION_TARGET);
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.error.code, "E_CALIB_INCOMPLETE_SAMPLE_KINDS");
  }
});

test("calibrateParameters: 全程只读，不修改知识库", async () => {
  const before = DEFAULT_DOCS.map((d) => d.id).join(",");
  await calibrateParameters(DEFAULT_ENHANCED_TEST_SET, DEFAULT_DOCS, DEFAULT_CALIBRATION_TARGET);
  const after = DEFAULT_DOCS.map((d) => d.id).join(",");
  assert.equal(before, after, "知识库文档不应被修改");
});