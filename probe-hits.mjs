import { defaultKnowledgeBase, KnowledgeReadonlySearchAdapter } from "./dist/knowledge/index.js";
import { DEFAULT_ENHANCED_TEST_SET } from "./dist/eval-calibration/index.js";

const kb = defaultKnowledgeBase();
const adapter = new KnowledgeReadonlySearchAdapter(kb);

console.log("=== current config threshold=20 gap=25 topK=3 ===");
for (const q of DEFAULT_ENHANCED_TEST_SET.queries) {
  const res = await adapter.search({ query: q.query });
  const hitIds = res.hits.map((h) => h.docId);
  if (q.sampleType === "positive") {
    const correct = q.relevantDocIds.every((id) => hitIds.includes(id));
    console.log(`${q.id} [${q.sampleKind}] ${JSON.stringify(q.query)} -> label[${q.relevantDocIds}] returned[${hitIds}] ${correct ? "HIT" : "MISS(FN)"}`);
  } else {
    console.log(`${q.id} [${q.sampleKind}] ${JSON.stringify(q.query)} -> returned[${hitIds}] ${hitIds.length ? "FP" : "EMPTY"}`);
  }
}
