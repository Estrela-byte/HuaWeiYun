import { KnowledgeBase } from "./knowledge-base.js";
import { DEFAULT_DOCS } from "./default-docs.js";

export { KnowledgeBase, tokenize } from "./knowledge-base.js";
export { DEFAULT_DOCS } from "./default-docs.js";
export { answerQuestion } from "./qa.js";

/** 构建含预置经营领域知识的本地知识库 */
export function defaultKnowledgeBase(): KnowledgeBase {
  return new KnowledgeBase(DEFAULT_DOCS);
}