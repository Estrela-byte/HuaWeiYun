import type { KnowledgeDoc, KnowledgeHit } from "../types/knowledge.js";

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

function scoreOf(doc: KnowledgeDoc, tokens: string[]): number {
  const titleTokens = new Set(tokenize(doc.title));
  const tagSet = new Set(doc.tags.map((t) => t.toLowerCase()));
  const contentTokens = new Set(tokenize(doc.content));
  let score = 0;
  for (const t of tokens) {
    if (titleTokens.has(t)) score += 10;
    if (tagSet.has(t)) score += 5;
    if (contentTokens.has(t)) score += 1;
  }
  return score;
}

/** 本地知识库：内存存储 + 关键词评分检索，无外部依赖、确定性可审计 */
export class KnowledgeBase {
  private docs: KnowledgeDoc[];

  constructor(docs: KnowledgeDoc[] = []) {
    this.docs = docs;
  }

  add(doc: KnowledgeDoc): void {
    this.docs.push(doc);
  }

  list(): KnowledgeDoc[] {
    return [...this.docs];
  }

  search(query: string, limit = 5): KnowledgeHit[] {
    const tokens = tokenize(query);
    const scored = this.docs.map((doc) => ({ doc, score: scoreOf(doc, tokens) }));
    return scored
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** 从 JSON 字符串批量加载知识文档 */
  static fromJSON(json: string): KnowledgeBase {
    const parsed = JSON.parse(json) as KnowledgeDoc[];
    return new KnowledgeBase(parsed);
  }
}