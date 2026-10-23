import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";

import {
  buildParameterCandidates,
  DEFAULT_PARAMETER_SEARCH_SPACE,
  type ParameterSearchSpace,
} from "./index.js";

test("buildParameterCandidates: 候选数量等于各组长度乘积", () => {
  const space = DEFAULT_PARAMETER_SEARCH_SPACE;
  const expected =
    space.weightSets.length *
    space.relevanceThresholds.length *
    space.scoreGapThresholds.length *
    space.maxTopKs.length;
  assert.equal(buildParameterCandidates(space).length, expected);
});

test("buildParameterCandidates: 遍历顺序确定（权重组 → 阈值 → 断层 → topK）", () => {
  const space: ParameterSearchSpace = {
    weightSets: [{ wTitle: Decimal.fromInt(20), wTag: Decimal.fromInt(8), wContent: Decimal.fromInt(1) }],
    relevanceThresholds: [Decimal.fromInt(9), Decimal.fromInt(15)],
    scoreGapThresholds: [Decimal.fromInt(50)],
    maxTopKs: [3, 5],
  };
  const candidates = buildParameterCandidates(space);
  assert.equal(candidates.length, 4);
  assert.equal(candidates[0]!.relevanceThreshold.toString(), "9");
  assert.equal(candidates[0]!.maxTopK, 3);
  assert.equal(candidates[1]!.relevanceThreshold.toString(), "9");
  assert.equal(candidates[1]!.maxTopK, 5);
  assert.equal(candidates[2]!.relevanceThreshold.toString(), "15");
  assert.equal(candidates[2]!.maxTopK, 3);
  assert.equal(candidates[3]!.relevanceThreshold.toString(), "15");
  assert.equal(candidates[3]!.maxTopK, 5);
});

test("buildParameterCandidates: 所有候选满足检索配置约束", () => {
  const zero = Decimal.fromInt(0);
  for (const c of buildParameterCandidates(DEFAULT_PARAMETER_SEARCH_SPACE)) {
    assert.ok(c.wTitle.gt(zero), "wTitle 应为正数");
    assert.ok(c.wTag.gt(zero), "wTag 应为正数");
    assert.ok(c.wContent.gt(zero), "wContent 应为正数");
    assert.ok(c.wTitle.gt(c.wTag), "应满足 wTitle > wTag");
    assert.ok(c.wTag.gt(c.wContent), "应满足 wTag > wContent");
    assert.ok(!c.relevanceThreshold.isNegative(), "relevanceThreshold 应为非负");
    assert.ok(c.scoreGapThreshold.gt(zero), "scoreGapThreshold 应为正数");
    assert.ok(
      Number.isInteger(c.maxTopK) && c.maxTopK >= 1 && c.maxTopK <= 10,
      "maxTopK 应为 1-10 整数",
    );
  }
});