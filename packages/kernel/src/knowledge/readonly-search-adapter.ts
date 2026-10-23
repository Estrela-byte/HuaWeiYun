import { Decimal } from "../types/decimal.js";
import type { KnowledgeBase } from "./knowledge-base.js";
import type {
  IReadonlySearch,
  ReadonlySearchRequest,
  ReadonlySearchResult,
  SearchHit,
} from "../search-eval/types.js";

/**
 * 只读检索适配器：将 KnowledgeBase 适配为评估组件的 IReadonlySearch 契约。
 * 仅暴露 search 方法，不调用 kb.add 等可写方法，满足评估只读守卫。
 */
export class KnowledgeReadonlySearchAdapter implements IReadonlySearch {
  private readonly kb: KnowledgeBase;

  constructor(kb: KnowledgeBase) {
    this.kb = kb;
  }

  async search(req: ReadonlySearchRequest): Promise<ReadonlySearchResult> {
    const hits = this.kb.search(req.query, req.topK);
    const searchHits: SearchHit[] = hits.map((h) => ({
      docId: h.doc.id,
      title: h.doc.title,
      snippet: h.doc.content.slice(0, 100),
      source: "local",
      relevance: Decimal.fromInt(Math.round(h.score)),
    }));
    return {
      hits: searchHits,
      degraded: false,
      emptyKnowledge: this.kb.list().length === 0,
    };
  }
}