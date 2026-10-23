import { test } from "node:test";
import assert from "node:assert/strict";
import { ingest } from "../data-ingestion/index.js";
import { govern } from "../data-governance/index.js";
import { analyze } from "../financial-analysis/index.js";
import { defaultKnowledgeBase, KnowledgeBase } from "./index.js";
import { answerQuestion } from "./qa.js";

const CSV = [
  "category,bizDate,amount,caliber,currency",
  "revenue,2024-01-10,100000,不含税,CNY",
  "cost,2024-01-10,60000,不含税,CNY",
  "revenue,2024-02-10,80000,不含税,CNY",
  "cost,2024-02-10,55000,不含税,CNY",
].join("\n");

test("知识库：关键词检索命中相关知识", () => {
  const kb = defaultKnowledgeBase();
  const hits = kb.search("什么是毛利率");
  assert.ok(hits.length > 0);
  assert.ok(hits[0]!.doc.title.includes("毛利率"));
});

test("知识库：从 JSON 批量加载文档", () => {
  const kb = defaultKnowledgeBase();
  const json = JSON.stringify([
    { id: "x", title: "自定义指标", tags: ["自定义"], content: "测试内容" },
  ]);
  const loaded = KnowledgeBase.fromJSON(json);
  assert.ok(loaded.search("自定义").length > 0);
  assert.equal(kb.list().length, 9);
});

test("智能问答：利润下降给出原因分析与计算依据", () => {
  const ing = ingest("file", { format: "csv", filename: "qa.csv", content: CSV });
  assert.ok(ing.ok);
  if (!ing.ok) return;
  const governed = govern(ing.value.records);
  const indicators = analyze(governed.unified);

  const answer = answerQuestion("为什么这个月利润下降了？", governed.unified, indicators, defaultKnowledgeBase());

  assert.ok(answer.reasons.length > 0);
  assert.ok(answer.basis.length > 0);
  assert.ok(answer.knowledgeHits.length > 0);
  assert.ok(answer.summary.length > 0);
});