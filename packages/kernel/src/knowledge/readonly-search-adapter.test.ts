import { test } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeBase, defaultKnowledgeBase } from "./index.js";
import { KnowledgeReadonlySearchAdapter } from "./readonly-search-adapter.js";

test("只读适配器：search 返回正确字段映射", async () => {
  const adapter = new KnowledgeReadonlySearchAdapter(defaultKnowledgeBase());
  const result = await adapter.search({ query: "毛利率" });
  assert.ok(result.hits.length > 0);
  assert.equal(result.hits[0]!.source, "local");
  assert.ok(result.hits[0]!.docId.length > 0);
  assert.ok(result.hits[0]!.title.length > 0);
  assert.equal(result.degraded, false);
  assert.equal(result.emptyKnowledge, false);
});

test("只读适配器：空库 emptyKnowledge=true", async () => {
  const adapter = new KnowledgeReadonlySearchAdapter(new KnowledgeBase([]));
  const result = await adapter.search({ query: "test" });
  assert.equal(result.emptyKnowledge, true);
  assert.equal(result.hits.length, 0);
});

test("只读适配器：仅暴露 search 方法无可写方法泄露", () => {
  const adapter = new KnowledgeReadonlySearchAdapter(defaultKnowledgeBase());
  const ownMethods = Object.getOwnPropertyNames(adapter).filter(
    (n) => typeof (adapter as unknown as Record<string, unknown>)[n] === "function",
  );
  assert.deepEqual(ownMethods, []);
  const proto = Object.getPrototypeOf(adapter);
  const protoMethods = Object.getOwnPropertyNames(proto).filter(
    (n) => n !== "constructor" && typeof (proto as Record<string, unknown>)[n] === "function",
  );
  assert.deepEqual(protoMethods, ["search"]);
});