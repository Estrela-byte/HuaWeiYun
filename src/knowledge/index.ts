import { KnowledgeBase } from "./knowledge-base.js";
import { DEFAULT_DOCS } from "./default-docs.js";

export { KnowledgeBase, tokenize } from "./knowledge-base.js";
export { DEFAULT_DOCS } from "./default-docs.js";
export { answerQuestion } from "./qa.js";
export {
  DEFAULT_SEARCH_PRECISION_CONFIG,
  loadSearchPrecisionConfig,
  validateSearchConfig,
  type SearchPrecisionConfig,
  type HitCounts,
  type ScoredDoc,
  type FilterResult,
} from "./search-precision-config.js";
export {
  countHits,
  scoreDocWith,
  filterByThreshold,
  detectScoreGap,
  dynamicTopK,
} from "./search-precision-core.js";
export { KnowledgeReadonlySearchAdapter } from "./readonly-search-adapter.js";
export { validateRecallGuard, type RecallGuardConclusion } from "./recall-guard.js";

/** 构建含预置经营领域知识的本地知识库 */
export function defaultKnowledgeBase(): KnowledgeBase {
  return new KnowledgeBase(DEFAULT_DOCS);
}