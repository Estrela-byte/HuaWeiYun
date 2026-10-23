import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTestSet } from "./testset-validator.js";
import type { EvalQuery, EvalTestSet } from "./types.js";

function positive(overrides: Partial<EvalQuery> = {}): EvalQuery {
  return { id: "p1", query: "正样本查询", sampleType: "positive", relevantDocIds: ["d1"], ...overrides };
}

function negative(overrides: Partial<EvalQuery> = {}): EvalQuery {
  return { id: "n1", query: "负样本查询", sampleType: "negative", relevantDocIds: [], ...overrides };
}

function set(...queries: EvalQuery[]): EvalTestSet {
  return { queries };
}

interface Problems {
  problems: { id: string; reason: string }[];
}

test("测试集校验：缺少正样本返回 E_EVAL_INVALID_TESTSET", () => {
  const r = validateTestSet(set(negative()));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_EVAL_INVALID_TESTSET");
    const details = r.error.details as Problems;
    assert.ok(details.problems.some((p) => p.reason.includes("正样本")));
  }
});

test("测试集校验：缺少负样本返回 E_EVAL_INVALID_TESTSET", () => {
  const r = validateTestSet(set(positive()));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_EVAL_INVALID_TESTSET");
    const details = r.error.details as Problems;
    assert.ok(details.problems.some((p) => p.reason.includes("负样本")));
  }
});

test("测试集校验：正样本标注集为空返回错误并标记查询 id", () => {
  const r = validateTestSet(set(positive({ relevantDocIds: [] }), negative()));
  assert.equal(r.ok, false);
  if (!r.ok) {
    const details = r.error.details as Problems;
    assert.ok(details.problems.some((p) => p.id === "p1" && p.reason.includes("标注")));
  }
});

test("测试集校验：负样本标注集非空返回错误并标记查询 id", () => {
  const r = validateTestSet(set(positive(), negative({ relevantDocIds: ["d1"] })));
  assert.equal(r.ok, false);
  if (!r.ok) {
    const details = r.error.details as Problems;
    assert.ok(details.problems.some((p) => p.id === "n1" && p.reason.includes("标注")));
  }
});

test("测试集校验：查询文本为空返回错误", () => {
  const r = validateTestSet(set(positive({ query: "   " }), negative()));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, "E_EVAL_INVALID_TESTSET");
  }
});

test("测试集校验：正负样本齐备且标注集完备时通过", () => {
  const r = validateTestSet(set(positive(), negative()));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.queries.length, 2);
  }
});