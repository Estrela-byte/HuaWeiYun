import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { evaluate } from "./evaluator.js";
import type {
  EvalTestSet,
  EvalThresholds,
  IReadonlySearch,
  ReadonlySearchRequest,
  ReadonlySearchResult,
  SearchHit,
} from "./types.js";

const thresholds: EvalThresholds = {
  recall: Decimal.fromString("0.5"),
  precision: Decimal.fromString("0.5"),
};

function hit(docId: string): SearchHit {
  return { docId, title: docId, snippet: "", source: "enterprise", relevance: Decimal.fromInt(1) };
}

function empty(): ReadonlySearchResult {
  return { hits: [], degraded: false, emptyKnowledge: true };
}

function testSet(): EvalTestSet {
  return {
    queries: [
      { id: "p1", query: "positive", sampleType: "positive", relevantDocIds: ["d1", "d2"] },
      { id: "n1", query: "negative", sampleType: "negative", relevantDocIds: [] },
    ],
  };
}

test("评估编排：正负样本混合产出完整报告且指标与手算一致", async () => {
  const search: IReadonlySearch = {
    async search(req: ReadonlySearchRequest): Promise<ReadonlySearchResult> {
      if (req.query === "positive") {
        return { hits: [hit("d1")], degraded: false, emptyKnowledge: false };
      }
      return empty();
    },
  };

  const result = await evaluate(testSet(), thresholds, search);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.ok(result.value.metrics.recall?.eq(Decimal.fromString("0.5")));
  assert.ok(result.value.metrics.precision?.eq(Decimal.fromString("1")));
  assert.equal(result.value.details.length, 2);
  assert.equal(result.value.scope.version, "");
});

test("评估编排：单条检索失败标记 failed 且不中断其余查询", async () => {
  const failingSet: EvalTestSet = {
    queries: [
      { id: "p1", query: "positive", sampleType: "positive", relevantDocIds: ["d1"] },
      { id: "p2", query: "fail", sampleType: "positive", relevantDocIds: ["d2"] },
      { id: "n1", query: "negative", sampleType: "negative", relevantDocIds: [] },
    ],
  };
  const search: IReadonlySearch = {
    async search(req: ReadonlySearchRequest): Promise<ReadonlySearchResult> {
      if (req.query === "fail") {
        throw new Error("retrieval failed");
      }
      if (req.query === "positive") {
        return { hits: [hit("d1")], degraded: false, emptyKnowledge: false };
      }
      return empty();
    },
  };

  const result = await evaluate(failingSet, thresholds, search);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  const failedDetail = result.value.details.find((d) => d.queryId === "p2");
  assert.ok(failedDetail);
  assert.equal(failedDetail.failed, true);
  assert.ok(result.value.metrics.recall?.eq(Decimal.fromString("1")));
  assert.ok(result.value.metrics.precision?.eq(Decimal.fromString("1")));
});

test("评估编排：检测到只读契约之外的可写方法时阻断", async () => {
  class WritableSearch implements IReadonlySearch {
    async search(_req: ReadonlySearchRequest): Promise<ReadonlySearchResult> {
      return empty();
    }
    add(_docId: string): void {
      void _docId;
    }
  }

  const result = await evaluate(testSet(), thresholds, new WritableSearch());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "E_EVAL_READONLY_VIOLATION");
  }
});

test("评估编排：测试集校验失败直接返回错误", async () => {
  const search: IReadonlySearch = {
    async search(): Promise<ReadonlySearchResult> {
      return empty();
    },
  };
  const invalidSet: EvalTestSet = {
    queries: [{ id: "p1", query: "positive", sampleType: "positive", relevantDocIds: ["d1"] }],
  };
  const result = await evaluate(invalidSet, thresholds, search);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "E_EVAL_INVALID_TESTSET");
  }
});