import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../financial-analysis/index.js";
import { govern } from "../data-governance/index.js";
import { ingest } from "../data-ingestion/index.js";
import { KnowledgeBase, defaultKnowledgeBase } from "./index.js";
import { answerQuestion } from "./qa.js";

const CSV = [
  "category,bizDate,amount,caliber,currency",
  "revenue,2024-01-10,100000,不含税,CNY",
  "cost,2024-01-10,60000,不含税,CNY",
  "revenue,2024-02-10,80000,不含税,CNY",
  "cost,2024-02-10,55000,不含税,CNY",
].join("\n");

test("改造后 search：标题命中文档排序靠前且弱相关被过滤", () => {
  const kb = defaultKnowledgeBase();
  const hits = kb.search("毛利率的定义和计算公式");
  assert.ok(hits.length > 0);
  assert.equal(hits[0]!.doc.title, "毛利率");
  assert.ok(hits.length <= 5);
});

test("改造后 search：无命中返回空数组", () => {
  const kb = defaultKnowledgeBase();
  assert.equal(kb.search("如何制作提拉米苏蛋糕").length, 0);
});

test("改造后 search：确定性可复现", () => {
  const kb = defaultKnowledgeBase();
  const r1 = kb.search("毛利率的定义和计算公式");
  const r2 = kb.search("毛利率的定义和计算公式");
  assert.deepEqual(
    r1.map((h) => h.doc.id),
    r2.map((h) => h.doc.id),
  );
});

test("改造后 search：配置缺省回退默认配置正常运行", () => {
  const kb = new KnowledgeBase();
  kb.add({ id: "x", title: "自定义指标", tags: ["自定义"], content: "测试内容" });
  assert.ok(kb.search("自定义").length > 0);
});

test("无改造兼容：answerQuestion 仍正常产出 QaAnswer", () => {
  const ing = ingest("file", { format: "csv", filename: "qa.csv", content: CSV });
  assert.ok(ing.ok);
  if (!ing.ok) {
    return;
  }
  const governed = govern(ing.value.records);
  const indicators = analyze(governed.unified);
  const answer = answerQuestion("为什么这个月利润下降了？", governed.unified, indicators, defaultKnowledgeBase());
  assert.ok(answer.reasons.length > 0);
  assert.ok(answer.knowledgeHits.length > 0);
  assert.ok(answer.summary.length > 0);
});