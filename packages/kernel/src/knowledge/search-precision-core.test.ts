import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "../types/decimal.js";
import { countHits, detectScoreGap, dynamicTopK, filterByThreshold, scoreDocWith } from "./search-precision-core.js";
import { tokenize } from "./knowledge-base.js";
import type { HitCounts, ScoredDoc } from "./search-precision-config.js";
import type { KnowledgeDoc } from "../types/knowledge.js";

function doc(id: string, title: string, tags: string[] = [], content: string = ""): KnowledgeDoc {
  return { id, title, tags, content };
}

function scored(id: string, score: number): ScoredDoc {
  return {
    doc: doc(id, id),
    score: Decimal.fromInt(score),
    counts: { titleHits: 0, tagHits: 0, contentHits: 0 },
  };
}

const weights = { wTitle: Decimal.fromInt(20), wTag: Decimal.fromInt(8), wContent: Decimal.fromInt(1) };

test("countHits：标题/标签/正文命中分别计数", () => {
  const d = doc("d1", "毛利率", ["毛利率"], "毛利率是毛利与收入的比值");
  const tokens = tokenize("毛利率");
  const c = countHits(d, tokens);
  assert.ok(c.titleHits > 0);
  assert.ok(c.tagHits > 0);
  assert.ok(c.contentHits > 0);
});

test("countHits：无命中返回全零计数", () => {
  const d = doc("d1", "毛利率", ["毛利率"], "毛利率定义");
  const tokens = tokenize("红烧肉");
  const c = countHits(d, tokens);
  assert.equal(c.titleHits, 0);
  assert.equal(c.tagHits, 0);
  assert.equal(c.contentHits, 0);
});

test("scoreDocWith：标题命中评分显著高于仅正文命中", () => {
  const titleHit: HitCounts = { titleHits: 1, tagHits: 0, contentHits: 0 };
  const contentOnly: HitCounts = { titleHits: 0, tagHits: 0, contentHits: 5 };
  assert.ok(scoreDocWith(titleHit, weights).gt(scoreDocWith(contentOnly, weights)));
});

test("scoreDocWith：标签命中高于正文命中", () => {
  const tagHit: HitCounts = { titleHits: 0, tagHits: 1, contentHits: 0 };
  const contentHit: HitCounts = { titleHits: 0, tagHits: 0, contentHits: 1 };
  assert.ok(scoreDocWith(tagHit, weights).gt(scoreDocWith(contentHit, weights)));
});

test("scoreDocWith：无命中返回零", () => {
  const zero: HitCounts = { titleHits: 0, tagHits: 0, contentHits: 0 };
  assert.ok(scoreDocWith(zero, weights).isZero());
});

test("filterByThreshold：保留 score >= threshold 并降序", () => {
  const input = [scored("a", 5), scored("b", 15), scored("c", 10)];
  const r = filterByThreshold(input, Decimal.fromInt(10));
  assert.equal(r.kept.length, 2);
  assert.equal(r.kept[0]!.doc.id, "b");
  assert.equal(r.kept[1]!.doc.id, "c");
  assert.equal(r.filteredCount, 1);
});

test("filterByThreshold：边界 score === threshold 保留", () => {
  const r = filterByThreshold([scored("a", 10)], Decimal.fromInt(10));
  assert.equal(r.kept.length, 1);
});

test("filterByThreshold：全过滤返回空", () => {
  const r = filterByThreshold([scored("a", 1), scored("b", 2)], Decimal.fromInt(10));
  assert.equal(r.kept.length, 0);
  assert.equal(r.filteredCount, 2);
});

test("filterByThreshold：相同分按 doc.id 字典序稳定排序", () => {
  const r = filterByThreshold([scored("b", 10), scored("a", 10)], Decimal.fromInt(1));
  assert.equal(r.kept[0]!.doc.id, "a");
  assert.equal(r.kept[1]!.doc.id, "b");
});

test("detectScoreGap：存在断层返回截断索引", () => {
  const sorted = [scored("a", 100), scored("b", 30), scored("c", 20)];
  assert.equal(detectScoreGap(sorted, Decimal.fromInt(50)), 1);
});

test("detectScoreGap：无断层返回 -1", () => {
  const sorted = [scored("a", 30), scored("b", 25), scored("c", 20)];
  assert.equal(detectScoreGap(sorted, Decimal.fromInt(50)), -1);
});

test("detectScoreGap：单元素返回 -1", () => {
  assert.equal(detectScoreGap([scored("a", 100)], Decimal.fromInt(50)), -1);
});

test("dynamicTopK：断层处截断仅保留高分群", () => {
  const sorted = [scored("a", 100), scored("b", 30), scored("c", 20)];
  const r = dynamicTopK(sorted, { maxTopK: 5, scoreGapThreshold: Decimal.fromInt(50) });
  assert.equal(r.length, 1);
});

test("dynamicTopK：无断层按 maxTopK 上限截断", () => {
  const sorted = [scored("a", 30), scored("b", 25), scored("c", 20)];
  const r = dynamicTopK(sorted, { maxTopK: 2, scoreGapThreshold: Decimal.fromInt(50) });
  assert.equal(r.length, 2);
});

test("dynamicTopK：截断后数量不超 maxTopK", () => {
  const sorted = [scored("a", 100), scored("b", 90), scored("c", 80), scored("d", 10)];
  const r = dynamicTopK(sorted, { maxTopK: 2, scoreGapThreshold: Decimal.fromInt(50) });
  assert.equal(r.length, 2);
});

test("dynamicTopK：空候选返回空", () => {
  const r = dynamicTopK([], { maxTopK: 5, scoreGapThreshold: Decimal.fromInt(50) });
  assert.equal(r.length, 0);
});