import { Decimal } from "../types/decimal.js";
import { tokenize } from "./knowledge-base.js";
import type { FilterResult, HitCounts, ScoredDoc, SearchPrecisionConfig } from "./search-precision-config.js";
import type { KnowledgeDoc } from "../types/knowledge.js";

/**
 * 命中计数统计：逐 token 判定是否命中标题/标签/正文，累加整数计数。
 * 复用存量 tokenize 分词，纯同步确定性函数。
 */
export function countHits(doc: KnowledgeDoc, tokens: readonly string[]): HitCounts {
  const titleTokens = new Set(tokenize(doc.title));
  const tagSet = new Set(doc.tags.map((t) => t.toLowerCase()));
  const contentTokens = new Set(tokenize(doc.content));
  let titleHits = 0;
  let tagHits = 0;
  let contentHits = 0;
  for (const t of tokens) {
    if (titleTokens.has(t)) titleHits += 1;
    if (tagSet.has(t)) tagHits += 1;
    if (contentTokens.has(t)) contentHits += 1;
  }
  return { titleHits, tagHits, contentHits };
}

/**
 * Decimal 加权评分：wTitle*titleHits + wTag*tagHits + wContent*contentHits。
 * 全程 Decimal 精算无浮点；三计数均为 0 时返回 Decimal.zero。
 */
export function scoreDocWith(
  counts: HitCounts,
  weights: Pick<SearchPrecisionConfig, "wTitle" | "wTag" | "wContent">,
): Decimal {
  const titleScore = weights.wTitle.mul(Decimal.fromInt(counts.titleHits));
  const tagScore = weights.wTag.mul(Decimal.fromInt(counts.tagHits));
  const contentScore = weights.wContent.mul(Decimal.fromInt(counts.contentHits));
  return titleScore.add(tagScore).add(contentScore);
}

/**
 * 相关度阈值过滤：保留 score >= threshold 的文档，按 Decimal 评分降序稳定排序（相同分按 doc.id 字典序兜底）。
 * 全过滤后 kept 为空数组（不抛异常）。纯同步确定性函数。
 */
export function filterByThreshold(scored: readonly ScoredDoc[], threshold: Decimal): FilterResult {
  const kept = scored.filter((s) => s.score.gte(threshold));
  kept.sort((a, b) => {
    const c = b.score.cmp(a.score);
    if (c !== 0) return c;
    return a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0;
  });
  return { kept, filteredCount: scored.length - kept.length };
}

/**
 * 得分断层检测：遍历降序候选相邻对，首个差值 >= gapThreshold 的位置即为截断索引（保留 [0, index)）。
 * 无断层返回 -1。前置条件：sorted 已按 Decimal 降序。纯同步确定性函数。
 */
export function detectScoreGap(sorted: readonly ScoredDoc[], gapThreshold: Decimal): number {
  for (let i = 0; i + 1 < sorted.length; i++) {
    const gap = sorted[i]!.score.sub(sorted[i + 1]!.score);
    if (gap.gte(gapThreshold)) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * 动态返回数量控制：存在断层则在断层处截断（仅保留高分群），再受 maxTopK 上限约束；
 * 无断层直接取 min(sorted.length, maxTopK)。返回数量始终 ≤ maxTopK。纯同步确定性函数。
 */
export function dynamicTopK(
  sorted: readonly ScoredDoc[],
  config: Pick<SearchPrecisionConfig, "maxTopK" | "scoreGapThreshold">,
): readonly ScoredDoc[] {
  if (sorted.length === 0) {
    return [];
  }
  const gapIndex = detectScoreGap(sorted, config.scoreGapThreshold);
  const count = gapIndex > 0 ? Math.min(gapIndex, config.maxTopK) : Math.min(sorted.length, config.maxTopK);
  return sorted.slice(0, count);
}