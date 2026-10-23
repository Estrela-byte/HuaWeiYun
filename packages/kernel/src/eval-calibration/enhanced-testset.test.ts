import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCS } from "../knowledge/index.js";
import { DEFAULT_ENHANCED_TEST_SET, toEvalTestSet } from "./index.js";
import type { EnhancedTestSet } from "./types.js";

test("toEvalTestSet: 剥离 sampleKind 且其余字段一致", () => {
  const enhanced: EnhancedTestSet = {
    queries: [
      {
        id: "x1",
        query: "毛利率",
        sampleType: "positive",
        sampleKind: "direct",
        relevantDocIds: ["kpi-gross-margin"],
        knowledgeIds: ["kb1"],
        version: "v1",
      },
    ],
  };
  const mapped = toEvalTestSet(enhanced);
  assert.equal(mapped.queries.length, 1);
  const q = mapped.queries[0]!;
  assert.equal(q.id, "x1");
  assert.equal(q.query, "毛利率");
  assert.equal(q.sampleType, "positive");
  assert.deepEqual([...q.relevantDocIds], ["kpi-gross-margin"]);
  assert.deepEqual([...(q.knowledgeIds ?? [])], ["kb1"]);
  assert.equal(q.version, "v1");
  assert.ok(!("sampleKind" in q), "sampleKind 应被剥离");
});

test("DEFAULT_ENHANCED_TEST_SET: 覆盖六类样本", () => {
  const kinds = new Set(DEFAULT_ENHANCED_TEST_SET.queries.map((q) => q.sampleKind));
  for (const k of ["direct", "colloquial", "paraphrase", "irrelevant", "distractor", "boundary"] as const) {
    assert.ok(kinds.has(k), `缺少 ${k} 样本`);
  }
});

test("DEFAULT_ENHANCED_TEST_SET: 标注完备且指向真实文档", () => {
  const docIds = new Set(DEFAULT_DOCS.map((d) => d.id));
  for (const q of DEFAULT_ENHANCED_TEST_SET.queries) {
    if (q.sampleType === "positive") {
      assert.ok(q.relevantDocIds.length > 0, `正样本 ${q.id} 标注为空`);
      for (const id of q.relevantDocIds) {
        assert.ok(docIds.has(id), `正样本 ${q.id} 标注 ${id} 不存在`);
      }
    } else {
      assert.equal(q.relevantDocIds.length, 0, `负样本 ${q.id} 标注应空`);
    }
  }
});

test("DEFAULT_ENHANCED_TEST_SET: 口语化/同义改写 query 与目标标题字面不同", () => {
  const titles = new Map(DEFAULT_DOCS.map((d) => [d.id, d.title]));
  for (const q of DEFAULT_ENHANCED_TEST_SET.queries) {
    if (q.sampleKind === "colloquial" || q.sampleKind === "paraphrase") {
      const targetTitle = titles.get(q.relevantDocIds[0]!)!;
      assert.ok(
        !q.query.includes(targetTitle),
        `样本 ${q.id} 的 query 含目标标题「${targetTitle}」，退化为直接正样本`,
      );
    }
  }
});