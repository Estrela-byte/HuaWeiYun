import { test } from "node:test";
import assert from "node:assert/strict";
import { orchestrate } from "./index.js";
import { buildDag, executeDag } from "./task-dag.js";
import { classifyTaskTypes } from "./router.js";

test("模糊诉求无法归类", () => {
  const r = orchestrate("帮我看下公司最近怎么样");
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.error.code, "E_UNCLASSIFIABLE");
});

test("财务诉求路由至财务分析", () => {
  assert.deepEqual(classifyTaskTypes("帮我算下利润和现金流"), ["analyze"]);
});

test("复合诉求路由至多环节", () => {
  assert.deepEqual(classifyTaskTypes("导入数据做个经营体检，并给出改善建议"), ["ingest", "diagnose", "strategize"]);
});

test("编排生成依赖链 DAG", () => {
  const r = orchestrate("导入数据做个体检再给建议");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.dag.length, 3);
    const diagnoseNode = r.value.dag.find((n) => n.taskType === "diagnose");
    assert.ok(diagnoseNode);
    assert.ok(diagnoseNode!.dependsOn.includes("ingest-1"));
  }
});

test("上游失败中止下游传播", () => {
  const dag = buildDag(["ingest", "analyze", "diagnose"]);
  const result = executeDag(dag, (node) => node.taskType !== "ingest");
  const ing = result.find((n) => n.taskType === "ingest");
  const ana = result.find((n) => n.taskType === "analyze");
  const diag = result.find((n) => n.taskType === "diagnose");
  assert.equal(ing!.status, "failed");
  assert.equal(ana!.status, "aborted");
  assert.equal(diag!.status, "aborted");
});

test("依赖全部成功则顺序成功", () => {
  const dag = buildDag(["ingest", "analyze"]);
  const result = executeDag(dag, () => true);
  assert.ok(result.every((n) => n.status === "success"));
});