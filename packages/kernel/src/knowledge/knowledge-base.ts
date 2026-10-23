import { AuditLogger } from "../shared/audit.js";
import type { KnowledgeDoc, KnowledgeHit } from "../types/knowledge.js";
import { countHits, dynamicTopK, filterByThreshold, scoreDocWith } from "./search-precision-core.js";
import {
  DEFAULT_SEARCH_PRECISION_CONFIG,
  type ScoredDoc,
  type SearchPrecisionConfig,
} from "./search-precision-config.js";

/** 关键词提取：中英文混合，中文用 2/3-gram 覆盖无空格分词场景 */
export function tokenize(text: string): string[] {
  const tokens = new Set<string>();
  const words = text.split(/[\s,，。！？、；：""''()（）\[\]【】:;!?]+/).filter(Boolean);
  for (const w of words) tokens.add(w.toLowerCase());
  const zh = text.replace(/[^\u4e00-\u9fa5]/g, "");
  for (let i = 0; i + 1 < zh.length; i++) tokens.add(zh.slice(i, i + 2));
  for (let i = 0; i + 2 < zh.length; i++) tokens.add(zh.slice(i, i + 3));
  return [...tokens];
}

/** 本地知识库：内存存储 + 确定性评分检索，无外部依赖、确定性可审计 */
export class KnowledgeBase {
  private docs: KnowledgeDoc[];
  private readonly config: SearchPrecisionConfig;

  constructor(docs: KnowledgeDoc[] = [], config?: SearchPrecisionConfig) {
    this.docs = docs;
    this.config = config ?? DEFAULT_SEARCH_PRECISION_CONFIG;
  }

  add(doc: KnowledgeDoc): void {
    this.docs.push(doc);
  }

  list(): KnowledgeDoc[] {
    return [...this.docs];
  }

  /**
   * 优化检索流水线：tokenize → 评分（Decimal 加权）→ 过滤有命中 → 阈值过滤 → 动态截断。
   * 签名 (query, limit?) 兼容既有调用方；limit 作为 maxTopK 回退上限。
   * KnowledgeHit.score 为展示用 number，不参与精算判定。
   */
  search(query: string, limit?: number): KnowledgeHit[] {
    const tokens = tokenize(query);
    const effectiveMaxTopK =
      limit !== undefined ? Math.min(limit, this.config.maxTopK) : this.config.maxTopK;

    const scored: ScoredDoc[] = this.docs.map((doc) => {
      const counts = countHits(doc, tokens);
      const score = scoreDocWith(counts, this.config);
      return { doc, score, counts };
    });

    const hitDocs = scored.filter((s) => !s.score.isZero());
    const { kept, filteredCount } = filterByThreshold(hitDocs, this.config.relevanceThreshold);
    const truncated = dynamicTopK(kept, {
      maxTopK: effectiveMaxTopK,
      scoreGapThreshold: this.config.scoreGapThreshold,
    });

    const audit = new AuditLogger();
    audit.log(
      "search.precision",
      "success",
      "default",
      `hits=${hitDocs.length} filtered=${filteredCount} returned=${truncated.length} top=${
        truncated[0]?.score.toString() ?? "none"
      } bottom=${truncated[truncated.length - 1]?.score.toString() ?? "none"}`,
    );

    return truncated.map((s) => ({ doc: s.doc, score: s.score.toNumber() }));
  }

  /** 从 JSON 字符串批量加载知识文档 */
  static fromJSON(json: string): KnowledgeBase {
    const parsed = JSON.parse(json) as KnowledgeDoc[];
    return new KnowledgeBase(parsed);
  }
}