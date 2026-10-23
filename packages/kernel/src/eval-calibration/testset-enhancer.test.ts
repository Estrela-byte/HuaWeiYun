import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCS } from "../knowledge/index.js";
import { DEFAULT_ENHANCED_TEST_SET, validateEnhancedTestSet } from "./index.js";
import type { EnhancedTestSet } from "./types.js";

test("validateEnhancedTestSet: 校验通过返回 ok", () => {
  const r = validateEnhancedTestSet(DEFAULT_ENHANCED_TEST_SET, DEFAULT_DOCS);
  assert.ok(r.ok, "预置增强测试集应校验通过");
});

test("validateEnhancedTestSet: 缺样本类型返回 E_CALIB_INCOMPLETE_SAMPLE_KINDS", () => {
  const queries = DEFAULT_ENHANCED_TEST_SET.queries.filter((q) => q.sampleKind !== "colloquial");
  const testSet: EnhancedTestSet = { queries };
  const r = validateEnhancedTestSet(testSet, DEFAULT_DOCS);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.error.code, "E_CALIB_INCOMPLETE_SAMPLE_KINDS");
  }
});

test("validateEnhancedTestSet: 标注指向不存在文档返回 E_CALIB_INVALID_ANNOTATION", () => {
  const queries = [
    ...DEFAULT_ENHANCED_TEST_SET.queries.filter((q) => q.id !== "d1"),
    {
      id: "d1",
      query: "毛利率",
      sampleType: "positive" as const,
      sampleKind: "direct" as const,
      relevantDocIds: ["nonexistent-doc"],
    },
  ];
  const testSet: EnhancedTestSet = { queries };
  const r = validateEnhancedTestSet(testSet, DEFAULT_DOCS);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.error.code, "E_CALIB_INVALID_ANNOTATION");
  }
});

test("validateEnhancedTestSet: 干扰负样本与知识库强对应返回 E_CALIB_DISTRACTOR_CONFLICT", () => {
  const queries = [
    ...DEFAULT_ENHANCED_TEST_SET.queries.filter((q) => q.id !== "f1"),
    {
      id: "f1",
      query: "现金流管理要点",
      sampleType: "negative" as const,
      sampleKind: "distractor" as const,
      relevantDocIds: [],
    },
  ];
  const testSet: EnhancedTestSet = { queries };
  const r = validateEnhancedTestSet(testSet, DEFAULT_DOCS);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.error.code, "E_CALIB_DISTRACTOR_CONFLICT");
  }
});