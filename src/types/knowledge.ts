// ============ 知识库与智能问答 ============

/** 知识文档：content 为 Markdown 文本，tags 为检索关键词标签 */
export interface KnowledgeDoc {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

/** 检索命中结果：score 为关键词匹配得分（越高越相关） */
export interface KnowledgeHit {
  doc: KnowledgeDoc;
  score: number;
}

/** 智能问答的计算依据条目 */
export interface QaBasisItem {
  metric: string;
  current: string;
  previous: string;
}

/** 智能问答结论：结合知识库检索与确定性计算内核产出 */
export interface QaAnswer {
  question: string;
  summary: string; // 直接回答
  reasons: string[]; // 原因分析
  suggestions: string[]; // 建议
  basis: QaBasisItem[]; // 计算依据
  knowledgeHits: string[]; // 命中的知识标题
}